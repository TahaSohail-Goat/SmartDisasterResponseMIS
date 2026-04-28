// require("dotenv").config();
// const express = require("express");
// const cors = require("cors");
// const { connectDB, getPool, sql } = require("./db");

// const app = express();
// app.use(cors());
// app.use(express.json());

// // ============================================================
// //  Health Check — verifies DB connection and table row counts
// // ============================================================
// app.get("/api/health", async (req, res) => {
//     try {
//         const pool = getPool();

//         const result = await pool.request().query(`
//             SELECT
//                 (SELECT COUNT(*) FROM Role)                  AS roles,
//                 (SELECT COUNT(*) FROM [User])                AS users,
//                 (SELECT COUNT(*) FROM Citizen)               AS citizens,
//                 (SELECT COUNT(*) FROM Disaster_Event)        AS disaster_events,
//                 (SELECT COUNT(*) FROM Emergency_Report)      AS emergency_reports,
//                 (SELECT COUNT(*) FROM Rescue_Team)           AS rescue_teams,
//                 (SELECT COUNT(*) FROM Team_Assignment)       AS team_assignments,
//                 (SELECT COUNT(*) FROM Resource)              AS resources,
//                 (SELECT COUNT(*) FROM Warehouse)             AS warehouses,
//                 (SELECT COUNT(*) FROM Warehouse_Inventory)   AS inventory_rows,
//                 (SELECT COUNT(*) FROM Resource_Allocation)   AS allocations,
//                 (SELECT COUNT(*) FROM Hospital)              AS hospitals,
//                 (SELECT COUNT(*) FROM Patient)               AS patients,
//                 (SELECT COUNT(*) FROM Donation)              AS donations,
//                 (SELECT COUNT(*) FROM Expense)               AS expenses,
//                 (SELECT COUNT(*) FROM Procurement)           AS procurements,
//                 (SELECT COUNT(*) FROM Financial_Transaction) AS financial_transactions,
//                 (SELECT COUNT(*) FROM Approval_Request)      AS approval_requests,
//                 (SELECT COUNT(*) FROM Audit_Log)             AS audit_log_entries
//         `);

//         res.json({
//             status: "ok",
//             database: process.env.DB_DATABASE,
//             server: process.env.DB_SERVER,
//             tableCounts: result.recordset[0]
//         });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Dashboard Stats — used by the Admin dashboard view
// // ============================================================
// app.get("/api/dashboard", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`SELECT * FROM vw_AdminDashboard`);
//         res.json({ status: "ok", data: result.recordset[0] });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Disaster Events — list all events
// // ============================================================
// app.get("/api/events", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT event_id, event_name, disaster_type, location,
//                    severity_level, status, start_date, end_date, description
//             FROM   Disaster_Event
//             ORDER  BY start_date DESC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Emergency Reports — list all reports with citizen name
// // ============================================================
// app.get("/api/reports", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT er.report_id, er.location, er.disaster_type,
//                    er.severity_level, er.report_time, er.status,
//                    er.description, c.full_name AS citizen_name,
//                    de.event_name
//             FROM   Emergency_Report er
//             JOIN   Citizen c          ON c.citizen_id        = er.citizen_id
//             JOIN   Disaster_Event de  ON de.event_id         = er.disaster_event_id
//             ORDER  BY er.report_time DESC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Rescue Teams — list all teams
// // ============================================================
// app.get("/api/teams", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT team_id, team_name, team_type, current_location,
//                    availability_status, team_size, contact_number
//             FROM   Rescue_Team
//             ORDER  BY availability_status, team_name
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Warehouse Inventory — via view
// // ============================================================
// app.get("/api/inventory", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT * FROM vw_WarehouseManager_Inventory
//             ORDER  BY stock_status DESC, warehouse_name
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Finance Summary — via view
// // ============================================================
// app.get("/api/finance", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT * FROM vw_FinanceOfficer_Summary
//             ORDER  BY net_balance DESC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Hospitals — via view
// // ============================================================
// app.get("/api/hospitals", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT * FROM vw_HospitalOccupancy
//             ORDER  BY occupancy_rate_pct DESC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Active Field Reports — via view
// // ============================================================
// app.get("/api/field-reports", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT * FROM vw_FieldOfficer_ActiveReports
//             ORDER  BY severity_level DESC, report_time ASC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Disaster Coordinator Events — via view
// // ============================================================
// app.get("/api/coordinator-events", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT * FROM vw_DisasterCoordinator_ActiveEvents
//             ORDER  BY severity_level DESC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // ============================================================
// //  Audit Log — recent entries
// // ============================================================
// app.get("/api/audit-log", async (req, res) => {
//     try {
//         const pool = getPool();
//         const result = await pool.request().query(`
//             SELECT TOP 50
//                    al.log_id, al.action, al.table_name,
//                    al.record_id, al.old_value, al.new_value,
//                    al.ip_address, al.[timestamp],
//                    u.username
//             FROM   Audit_Log al
//             JOIN   [User] u ON u.user_id = al.user_id
//             ORDER  BY al.[timestamp] DESC
//         `);
//         res.json({ status: "ok", data: result.recordset });
//     } catch (err) {
//         res.status(500).json({ status: "error", message: err.message });
//     }
// });

// // Root
// app.get("/", (req, res) => {
//     res.json({
//         message: "Smart Disaster Response MIS API",
//         version: "1.0.0",
//         endpoints: [
//             "GET /api/health",
//             "GET /api/dashboard",
//             "GET /api/events",
//             "GET /api/reports",
//             "GET /api/teams",
//             "GET /api/inventory",
//             "GET /api/finance",
//             "GET /api/hospitals",
//             "GET /api/field-reports",
//             "GET /api/coordinator-events",
//             "GET /api/audit-log"
//         ]
//     });
// });

// // Start server
// const PORT = process.env.PORT || 5000;

// connectDB().then(() => {
//     app.listen(PORT, () => {
//         console.log(`🚀 Server running on http://localhost:${PORT}`);
//         console.log(`🔍 Health check: http://localhost:${PORT}/api/health`);
//     });
// });


// server.js — Smart Disaster Response MIS
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRouter      = require('./routes/auth');
const eventsRouter    = require('./routes/events');
const reportsRouter   = require('./routes/reports');
const teamsRouter     = require('./routes/teams');
const { inventoryRouter } = require('./routes/inventory');
const { financeRouter }   = require('./routes/finance');
const { hospitalsRouter } = require('./routes/hospitals');
const { adminRouter }     = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// ── Middleware ───────────────────────────────────────────────
app.use(cors({ origin: '*' }));   // tighten to frontend URL in production
app.use(express.json());

// ── Request logger (dev) ────────────────────────────────────
app.use((req, _res, next) => {
    console.log(`${new Date().toISOString()}  ${req.method}  ${req.path}`);
    next();
});

// ── Routes ───────────────────────────────────────────────────
app.use('/api/auth',      authRouter);
app.use('/api/events',    eventsRouter);
app.use('/api/reports',   reportsRouter);
app.use('/api/teams',     teamsRouter);
app.use('/api/inventory', inventoryRouter);
app.use('/api/finance',   financeRouter);
app.use('/api/hospitals', hospitalsRouter);
app.use('/api/admin',     adminRouter);

// ── Health check ─────────────────────────────────────────────
app.get('/api/health', (_req, res) => res.json({ status: 'ok', time: new Date() }));

// ── Root Info ────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        message: "Smart Disaster Response MIS API",
        version: "1.0.0",
        endpoints: [
            "GET /api/health",
            "POST /api/auth/login",
            "GET /api/events",
            "GET /api/reports",
            "GET /api/teams",
            "GET /api/inventory",
            "GET /api/finance/summary",
            "GET /api/hospitals"
        ]
    });
});

// ── 404 ──────────────────────────────────────────────────────
app.use((_req, res) => res.status(404).json({ error: 'Route not found' }));

// ── Global error handler ─────────────────────────────────────
app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// ── Start ────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🚀  Server running on http://localhost:${PORT}`);
});
