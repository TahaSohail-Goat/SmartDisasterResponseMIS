const express = require('express');
const { getPool } = require('../db');
const { authenticate } = require('../middleware/auth');

const analyticsRouter = express.Router();
analyticsRouter.use(authenticate);

analyticsRouter.get('/overview', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        (SELECT COUNT(*) FROM Disaster_Event WHERE status IN ('Active','Pending')) AS active_events,
        (SELECT COUNT(*) FROM Emergency_Report WHERE status IN ('Active','Pending')) AS open_reports,
        (SELECT COUNT(*) FROM Emergency_Report WHERE severity_level = 'Critical') AS critical_reports,
        (SELECT COUNT(*) FROM Rescue_Team WHERE availability_status = 'Available') AS available_teams,
        (SELECT COUNT(*) FROM Warehouse_Inventory WHERE quantity < threshold_level) AS low_stock_items,
        (SELECT COUNT(*) FROM Approval_Request WHERE status = 'Pending') AS pending_approvals,
        (SELECT SUM(amount) FROM Financial_Transaction WHERE transaction_type = 'Donation') AS total_donations,
        (SELECT SUM(amount) FROM Financial_Transaction WHERE transaction_type IN ('Expense','Procurement')) AS total_spend
    `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRouter.get('/incident-severity', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT severity_level, COUNT(*) AS report_count
      FROM Emergency_Report
      GROUP BY severity_level
      ORDER BY CASE severity_level WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRouter.get('/reports-by-location', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT TOP 10 location, COUNT(*) AS report_count
      FROM Emergency_Report
      GROUP BY location
      ORDER BY report_count DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRouter.get('/resource-utilization', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        R.resource_type,
        R.resource_name,
        SUM(RA.allocated_quantity) AS allocated_quantity,
        SUM(RA.dispatched_quantity) AS dispatched_quantity,
        SUM(RA.consumed_quantity) AS consumed_quantity
      FROM Resource_Allocation RA
      INNER JOIN Warehouse_Inventory WI ON WI.inventory_id = RA.inventory_id
      INNER JOIN Resource R ON R.resource_id = WI.resource_id
      GROUP BY R.resource_type, R.resource_name
      ORDER BY dispatched_quantity DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRouter.get('/finance-by-event', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT event_id, event_name, total_donations, approved_expenses,
             procurement_spend, net_balance
      FROM vw_FinanceOfficer_Summary
      ORDER BY ABS(net_balance) DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRouter.get('/response-times', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        DE.event_name,
        ER.severity_level,
        AVG(CAST(DATEDIFF(MINUTE, ER.report_time, TA.assigned_at) AS FLOAT)) AS avg_response_minutes,
        COUNT(TA.assignment_id) AS assignment_count
      FROM Emergency_Report ER
      INNER JOIN Disaster_Event DE ON DE.event_id = ER.disaster_event_id
      INNER JOIN Team_Assignment TA ON TA.report_id = ER.report_id
      GROUP BY DE.event_name, ER.severity_level
      ORDER BY avg_response_minutes
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

analyticsRouter.get('/approvals', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT request_type, status, COUNT(*) AS request_count
      FROM Approval_Request
      GROUP BY request_type, status
      ORDER BY request_type, status
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = { analyticsRouter };
