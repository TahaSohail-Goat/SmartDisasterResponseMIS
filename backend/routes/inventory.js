
// ============================================================
// routes/inventory.js
// ============================================================
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const inventoryRouter = express.Router();
inventoryRouter.use(authenticate);

// GET /api/inventory — via vw_WarehouseManager_Inventory
// NOTE: The view already includes inventory_id, warehouse_id, resource_id.
// Do NOT join back to Warehouse/Resource/Warehouse_Inventory on string columns
// (warehouse_name, resource_name) — that fans out and duplicates rows.
inventoryRouter.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT
                WI.inventory_id,
                V.resource_name,
                V.resource_type,
                V.unit_of_measure,
                V.warehouse_name,
                V.warehouse_location,
                V.current_stock,
                V.threshold_level,
                V.last_updated,
                V.buffer_above_threshold,
                V.pending_procurement_qty,
                V.projected_stock,
                V.stock_alert,
                CASE WHEN V.stock_alert IN ('LOW STOCK','OUT OF STOCK') THEN 1 ELSE 0 END AS stock_alert_flag
            FROM vw_WarehouseManager_Inventory V
            INNER JOIN Warehouse_Inventory WI
                ON  WI.warehouse_id = V.warehouse_id
                AND WI.resource_id  = V.resource_id
            ORDER BY
                CASE WHEN V.stock_alert IN ('LOW STOCK','OUT OF STOCK') THEN 0 ELSE 1 END,
                V.current_stock ASC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/inventory/allocate — resource allocation (Transaction 1)
inventoryRouter.post('/allocate',
    authorize('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'),
    async (req, res) => {
        const { inventory_id, report_id, allocated_quantity } = req.body;
        if (!inventory_id || !report_id || !allocated_quantity)
            return res.status(400).json({ error: 'inventory_id, report_id, allocated_quantity required' });

        const pool = await getPool();
        const tx = new (require('mssql').Transaction)(await pool);

        try {
            await tx.begin();
            const request = new (require('mssql').Request)(tx);

            // Check stock
            const stock = await request
                .input('inv_id', sql.Int, inventory_id)
                .query(`SELECT quantity FROM Warehouse_Inventory WITH (UPDLOCK,ROWLOCK) WHERE inventory_id = @inv_id`);

            if (!stock.recordset.length) throw new Error('Inventory record not found');
            if (stock.recordset[0].quantity < allocated_quantity)
                throw new Error(`Insufficient stock. Available: ${stock.recordset[0].quantity}`);

            const req2 = new (require('mssql').Request)(tx);
            const alloc = await req2
                .input('inventory_id', sql.Int, inventory_id)
                .input('report_id', sql.Int, report_id)
                .input('requested_by', sql.Int, req.user.user_id)
                .input('allocated_quantity', sql.Int, allocated_quantity)
                .query(`
                    DECLARE @insertedAllocations TABLE (allocation_id INT);

                    INSERT INTO Resource_Allocation
                        (inventory_id, report_id, requested_by, allocated_quantity,
                         dispatched_quantity, consumed_quantity, allocation_date, status)
                    OUTPUT INSERTED.allocation_id INTO @insertedAllocations
                    VALUES (@inventory_id, @report_id, @requested_by, @allocated_quantity,
                            0, 0, GETDATE(), 'Pending');

                    SELECT allocation_id FROM @insertedAllocations;
                `);

            const req3 = new (require('mssql').Request)(tx);
            await req3
                .input('requested_by', sql.Int, req.user.user_id)
                .input('allocation_id', sql.Int, alloc.recordset[0].allocation_id)
                .input('remarks', sql.Text, 'Auto-generated from inventory allocation request')
                .query(`
                    INSERT INTO Approval_Request
                        (request_type, requested_by, approved_by, allocation_id, status, request_date, resolved_date, remarks)
                    VALUES
                        ('Resource_Allocation', @requested_by, NULL, @allocation_id, 'Pending', GETDATE(), NULL, @remarks)
                `);

            await tx.commit();
            res.status(201).json({ allocation_id: alloc.recordset[0].allocation_id, message: 'Allocation created, pending approval' });
        } catch (err) {
            await tx.rollback();
            res.status(400).json({ error: err.message });
        }
    }
);

module.exports.inventoryRouter = inventoryRouter;
