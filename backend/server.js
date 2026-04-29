require('dotenv').config({ quiet: true });
const express = require('express');
const cors = require('cors');

const { getPool } = require('./db');
const authRouter = require('./routes/auth');
const eventsRouter = require('./routes/events');
const reportsRouter = require('./routes/reports');
const teamsRouter = require('./routes/teams');
const { inventoryRouter } = require('./routes/inventory');
const { financeRouter } = require('./routes/finance');
const { hospitalsRouter } = require('./routes/hospitals');
const { adminRouter } = require('./routes/admin');
const { procurementRouter } = require('./routes/procurement');
const { resourcesRouter } = require('./routes/resources');
const { warehousesRouter } = require('./routes/warehouses');
const { analyticsRouter } = require('./routes/analytics');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json());

if (process.env.NODE_ENV !== 'test') {
  app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
    next();
  });
}

app.get('/api/health', async (_req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT
        DB_NAME() AS database_name,
        (SELECT COUNT(*) FROM Role) AS roles,
        (SELECT COUNT(*) FROM [User]) AS users,
        (SELECT COUNT(*) FROM Citizen) AS citizens,
        (SELECT COUNT(*) FROM Disaster_Event) AS disaster_events,
        (SELECT COUNT(*) FROM Emergency_Report) AS emergency_reports,
        (SELECT COUNT(*) FROM Rescue_Team) AS rescue_teams,
        (SELECT COUNT(*) FROM Team_Assignment) AS team_assignments,
        (SELECT COUNT(*) FROM Resource) AS resources,
        (SELECT COUNT(*) FROM Warehouse) AS warehouses,
        (SELECT COUNT(*) FROM Warehouse_Inventory) AS inventory_rows,
        (SELECT COUNT(*) FROM Resource_Allocation) AS allocations,
        (SELECT COUNT(*) FROM Hospital) AS hospitals,
        (SELECT COUNT(*) FROM Patient) AS patients,
        (SELECT COUNT(*) FROM Donation) AS donations,
        (SELECT COUNT(*) FROM Expense) AS expenses,
        (SELECT COUNT(*) FROM Procurement) AS procurements,
        (SELECT COUNT(*) FROM Financial_Transaction) AS financial_transactions,
        (SELECT COUNT(*) FROM Approval_Request) AS approval_requests,
        (SELECT COUNT(*) FROM Audit_Log) AS audit_log_entries
    `);

    const { database_name, ...tableCounts } = result.recordset[0];
    res.json({
      status: 'ok',
      database: database_name,
      server: process.env.DB_SERVER || 'localhost',
      tableCounts,
      time: new Date().toISOString(),
    });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

app.use('/api/auth', authRouter);
app.use('/api/events', eventsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/teams', teamsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/finance', financeRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/admin', adminRouter);
app.use('/api/procurements', procurementRouter);
app.use('/api/resources', resourcesRouter);
app.use('/api/warehouses', warehousesRouter);
app.use('/api/analytics', analyticsRouter);

app.get('/api/dashboard', async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM vw_Admin_SystemOverview');
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

app.get('/api/field-reports', async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM vw_FieldOfficer_ActiveReports
      ORDER BY
        CASE severity_level WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        minutes_since_report DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

app.get('/api/coordinator-events', async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM vw_Coordinator_ActiveEvents
      ORDER BY
        CASE severity_level WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        start_date DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

app.get('/api/audit-log', async (_req, res, next) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT * FROM vw_AuditTrail_Recent');
    res.json(result.recordset);
  } catch (err) {
    next(err);
  }
});

app.get('/', (_req, res) => {
  res.json({
    message: 'Smart Disaster Response MIS API',
    version: '1.0.0',
    endpoints: [
      'GET /api/health',
      'POST /api/auth/login',
      'POST /api/auth/signup',
      'GET /api/events',
      'GET /api/reports',
      'GET /api/teams',
      'GET /api/inventory',
      'GET /api/finance/summary',
      'GET /api/hospitals',
      'GET /api/procurements',
      'GET /api/resources',
      'GET /api/warehouses',
      'GET /api/analytics/overview',
      'GET /api/admin/approvals',
      'GET /api/admin/audit',
    ],
  });
});

app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

async function start() {
  try {
    const pool = await getPool();
    console.log(`Connected to SQL Server database: ${pool.config.database}`);
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
      console.log(`Health check: http://localhost:${PORT}/api/health`);
    });
  } catch (err) {
    console.error('DB Connection Error:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  start();
}

module.exports = app;
