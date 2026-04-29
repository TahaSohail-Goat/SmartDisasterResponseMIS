const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const warehousesRouter = express.Router();
warehousesRouter.use(authenticate);

warehousesRouter.get('/', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        W.warehouse_id,
        W.warehouse_name,
        W.location,
        W.capacity,
        W.contact_number,
        W.manager_id,
        U.username AS manager_username,
        COUNT(WI.inventory_id) AS inventory_items,
        ISNULL(SUM(WI.quantity), 0) AS total_units
      FROM Warehouse W
      INNER JOIN [User] U ON U.user_id = W.manager_id
      LEFT JOIN Warehouse_Inventory WI ON WI.warehouse_id = W.warehouse_id
      GROUP BY W.warehouse_id, W.warehouse_name, W.location, W.capacity,
               W.contact_number, W.manager_id, U.username
      ORDER BY W.warehouse_name
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

warehousesRouter.post('/', authorize('System_Admin', 'Warehouse_Manager'), async (req, res) => {
  const { warehouse_name, location, capacity, contact_number, manager_id } = req.body;
  if (!warehouse_name || !location || !capacity || !contact_number || !manager_id) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('warehouse_name', sql.VarChar, warehouse_name)
      .input('location', sql.VarChar, location)
      .input('capacity', sql.Int, capacity)
      .input('contact_number', sql.VarChar, contact_number)
      .input('manager_id', sql.Int, manager_id)
      .query(`
        INSERT INTO Warehouse (warehouse_name, location, capacity, contact_number, manager_id)
        OUTPUT INSERTED.warehouse_id
        VALUES (@warehouse_name, @location, @capacity, @contact_number, @manager_id)
      `);
    res.status(201).json({ warehouse_id: result.recordset[0].warehouse_id, message: 'Warehouse created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

warehousesRouter.patch('/:id', authorize('System_Admin', 'Warehouse_Manager'), async (req, res) => {
  const { warehouse_name, location, capacity, contact_number, manager_id } = req.body;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('warehouse_name', sql.VarChar, warehouse_name || null)
      .input('location', sql.VarChar, location || null)
      .input('capacity', sql.Int, capacity || null)
      .input('contact_number', sql.VarChar, contact_number || null)
      .input('manager_id', sql.Int, manager_id || null)
      .query(`
        UPDATE Warehouse
        SET warehouse_name = COALESCE(@warehouse_name, warehouse_name),
            location = COALESCE(@location, location),
            capacity = COALESCE(@capacity, capacity),
            contact_number = COALESCE(@contact_number, contact_number),
            manager_id = COALESCE(@manager_id, manager_id)
        WHERE warehouse_id = @id;

        SELECT @@ROWCOUNT AS updated;
      `);

    if (!result.recordset[0].updated) return res.status(404).json({ error: 'Warehouse not found' });
    res.json({ message: 'Warehouse updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

warehousesRouter.get('/:id/inventory', async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT
          WI.inventory_id,
          WI.warehouse_id,
          R.resource_id,
          R.resource_name,
          R.resource_type,
          R.unit_of_measure,
          WI.quantity,
          WI.threshold_level,
          WI.last_updated
        FROM Warehouse_Inventory WI
        INNER JOIN Resource R ON R.resource_id = WI.resource_id
        WHERE WI.warehouse_id = @id
        ORDER BY R.resource_type, R.resource_name
      `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { warehousesRouter };
