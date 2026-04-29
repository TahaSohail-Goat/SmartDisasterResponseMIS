const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const procurementRouter = express.Router();
procurementRouter.use(authenticate);

procurementRouter.get('/', authorize('System_Admin', 'Warehouse_Manager', 'Finance_Officer'), async (req, res) => {
  try {
    const { status, warehouse_id, resource_id } = req.query;
    const pool = await getPool();
    const request = pool.request();
    let where = 'WHERE 1=1';

    if (status) {
      request.input('status', sql.VarChar, status);
      where += ' AND P.status = @status';
    }
    if (warehouse_id) {
      request.input('warehouse_id', sql.Int, warehouse_id);
      where += ' AND P.warehouse_id = @warehouse_id';
    }
    if (resource_id) {
      request.input('resource_id', sql.Int, resource_id);
      where += ' AND P.resource_id = @resource_id';
    }

    const result = await request.query(`
      SELECT
        P.procurement_id,
        P.resource_id,
        R.resource_name,
        R.resource_type,
        P.warehouse_id,
        W.warehouse_name,
        P.disaster_event_id,
        DE.event_name,
        P.quantity,
        P.unit_cost,
        CAST(P.quantity * P.unit_cost AS DECIMAL(15,2)) AS total_cost,
        P.procurement_date,
        P.supplier_name,
        P.approved_by,
        U.username AS approved_by_name,
        P.status
      FROM Procurement P
      INNER JOIN Resource R ON R.resource_id = P.resource_id
      INNER JOIN Warehouse W ON W.warehouse_id = P.warehouse_id
      LEFT JOIN Disaster_Event DE ON DE.event_id = P.disaster_event_id
      INNER JOIN [User] U ON U.user_id = P.approved_by
      ${where}
      ORDER BY P.procurement_date DESC
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

procurementRouter.post('/', authorize('System_Admin', 'Warehouse_Manager'), async (req, res) => {
  const {
    resource_id,
    warehouse_id,
    disaster_event_id,
    quantity,
    unit_cost,
    supplier_name,
    remarks,
  } = req.body;

  if (!resource_id || !warehouse_id || !disaster_event_id || !quantity || !unit_cost || !supplier_name) {
    return res.status(400).json({ error: 'resource_id, warehouse_id, disaster_event_id, quantity, unit_cost, and supplier_name are required' });
  }

  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const procurement = await new sql.Request(tx)
      .input('resource_id', sql.Int, resource_id)
      .input('warehouse_id', sql.Int, warehouse_id)
      .input('disaster_event_id', sql.Int, disaster_event_id)
      .input('quantity', sql.Int, quantity)
      .input('unit_cost', sql.Decimal(15, 2), unit_cost)
      .input('supplier_name', sql.VarChar, supplier_name)
      .input('approved_by', sql.Int, req.user.user_id)
      .query(`
        INSERT INTO Procurement
          (resource_id, warehouse_id, disaster_event_id, quantity, unit_cost,
           procurement_date, supplier_name, approved_by, status)
        OUTPUT INSERTED.procurement_id
        VALUES
          (@resource_id, @warehouse_id, @disaster_event_id, @quantity, @unit_cost,
           GETDATE(), @supplier_name, @approved_by, 'Pending')
      `);

    const procurementId = procurement.recordset[0].procurement_id;

    await new sql.Request(tx)
      .input('requested_by', sql.Int, req.user.user_id)
      .input('procurement_id', sql.Int, procurementId)
      .input('remarks', sql.Text, remarks || `Procurement #${procurementId} awaiting approval`)
      .query(`
        INSERT INTO Approval_Request
          (request_type, requested_by, approved_by, allocation_id, procurement_id, assignment_id,
           status, request_date, resolved_date, remarks)
        VALUES
          ('Procurement', @requested_by, NULL, NULL, @procurement_id, NULL,
           'Pending', GETDATE(), NULL, @remarks)
      `);

    await tx.commit();
    res.status(201).json({ procurement_id: procurementId, message: 'Procurement request created' });
  } catch (err) {
    try { await tx.rollback(); } catch { /* closed */ }
    res.status(400).json({ error: err.message });
  }
});

procurementRouter.patch('/:id/approve', authorize('System_Admin', 'Finance_Officer'), async (req, res) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const current = await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT procurement_id, disaster_event_id, quantity, unit_cost, status
        FROM Procurement WITH (UPDLOCK, ROWLOCK)
        WHERE procurement_id = @id
      `);

    if (!current.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ error: 'Procurement not found' });
    }

    const procurement = current.recordset[0];
    if (procurement.status !== 'Pending') {
      await tx.rollback();
      return res.status(409).json({ error: `Procurement is already ${procurement.status}` });
    }

    await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .input('approved_by', sql.Int, req.user.user_id)
      .query(`
        UPDATE Procurement
        SET status = 'Completed',
            approved_by = @approved_by
        WHERE procurement_id = @id;

        UPDATE Approval_Request
        SET status = 'Approved',
            approved_by = @approved_by,
            resolved_date = GETDATE()
        WHERE procurement_id = @id
        AND status = 'Pending';
      `);

    await new sql.Request(tx)
      .input('ref_id', sql.Int, procurement.procurement_id)
      .input('event_id', sql.Int, procurement.disaster_event_id)
      .input('amount', sql.Decimal(15, 2), procurement.quantity * procurement.unit_cost)
      .input('recorded_by', sql.Int, req.user.user_id)
      .input('notes', sql.Text, `Procurement #${procurement.procurement_id} approved`)
      .query(`
        INSERT INTO Financial_Transaction
          (transaction_type, reference_id, disaster_event_id, amount, transaction_date, recorded_by, notes)
        VALUES
          ('Procurement', @ref_id, @event_id, @amount, GETDATE(), @recorded_by, @notes)
      `);

    await tx.commit();
    res.json({ message: 'Procurement approved' });
  } catch (err) {
    try { await tx.rollback(); } catch { /* closed */ }
    res.status(500).json({ error: err.message });
  }
});

procurementRouter.patch('/:id/reject', authorize('System_Admin', 'Finance_Officer'), async (req, res) => {
  const { notes } = req.body;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('approved_by', sql.Int, req.user.user_id)
      .input('remarks', sql.Text, notes || null)
      .query(`
        UPDATE Procurement
        SET status = 'Inactive'
        WHERE procurement_id = @id
        AND status = 'Pending';

        UPDATE Approval_Request
        SET status = 'Rejected',
            approved_by = @approved_by,
            resolved_date = GETDATE(),
            remarks = COALESCE(@remarks, remarks)
        WHERE procurement_id = @id
        AND status = 'Pending';
      `);

    if (!result.rowsAffected.some((count) => count > 0)) {
      return res.status(404).json({ error: 'Pending procurement not found' });
    }

    res.json({ message: 'Procurement rejected' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { procurementRouter };
