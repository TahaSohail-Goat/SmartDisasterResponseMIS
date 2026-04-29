const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const resourcesRouter = express.Router();
resourcesRouter.use(authenticate);

resourcesRouter.get('/', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT resource_id, resource_name, resource_type, unit_of_measure, description
      FROM Resource
      ORDER BY resource_type, resource_name
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

resourcesRouter.post('/', authorize('System_Admin', 'Warehouse_Manager'), async (req, res) => {
  const { resource_name, resource_type, unit_of_measure, description } = req.body;
  if (!resource_name || !resource_type || !unit_of_measure || !description) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('resource_name', sql.VarChar, resource_name)
      .input('resource_type', sql.VarChar, resource_type)
      .input('unit_of_measure', sql.VarChar, unit_of_measure)
      .input('description', sql.Text, description)
      .query(`
        INSERT INTO Resource (resource_name, resource_type, unit_of_measure, description)
        OUTPUT INSERTED.resource_id
        VALUES (@resource_name, @resource_type, @unit_of_measure, @description)
      `);
    res.status(201).json({ resource_id: result.recordset[0].resource_id, message: 'Resource created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

resourcesRouter.patch('/:id', authorize('System_Admin', 'Warehouse_Manager'), async (req, res) => {
  const { resource_name, resource_type, unit_of_measure, description } = req.body;

  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .input('resource_name', sql.VarChar, resource_name || null)
      .input('resource_type', sql.VarChar, resource_type || null)
      .input('unit_of_measure', sql.VarChar, unit_of_measure || null)
      .input('description', sql.Text, description || null)
      .query(`
        UPDATE Resource
        SET resource_name = COALESCE(@resource_name, resource_name),
            resource_type = COALESCE(@resource_type, resource_type),
            unit_of_measure = COALESCE(@unit_of_measure, unit_of_measure),
            description = COALESCE(@description, description)
        WHERE resource_id = @id;

        SELECT @@ROWCOUNT AS updated;
      `);

    if (!result.recordset[0].updated) return res.status(404).json({ error: 'Resource not found' });
    res.json({ message: 'Resource updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

resourcesRouter.delete('/:id', authorize('System_Admin'), async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query('DELETE FROM Resource WHERE resource_id = @id');

    if (!result.rowsAffected[0]) return res.status(404).json({ error: 'Resource not found' });
    res.json({ message: 'Resource deleted' });
  } catch (err) {
    res.status(409).json({ error: err.message });
  }
});

module.exports = { resourcesRouter };
