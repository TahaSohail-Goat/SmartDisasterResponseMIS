// routes/reports.js — Emergency Reports
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/reports — with optional filters ──────────────────
router.get('/', async (req, res) => {
  try {
    const { event_id, severity, status } = req.query;
    const pool    = await getPool();
    const request = pool.request();

    let where = 'WHERE 1=1';
    if (event_id)  { request.input('event_id',  sql.Int,     event_id);  where += ' AND ER.disaster_event_id = @event_id'; }
    if (severity)  { request.input('severity',  sql.VarChar, severity);  where += ' AND ER.severity_level = @severity'; }
    if (status)    { request.input('status',    sql.VarChar, status);    where += ' AND ER.status = @status'; }

    const result = await request.query(`
      SELECT ER.report_id, ER.location, ER.latitude, ER.longitude,
             ER.disaster_type, ER.severity_level, ER.report_time,
             ER.status, ER.description,
             C.full_name   AS citizen_name,
             U.phone       AS citizen_phone,
             DE.event_name,
             ISNULL(TA.teams_assigned, 0) AS teams_assigned
      FROM   Emergency_Report ER
      INNER JOIN Citizen        C  ON C.citizen_id  = ER.citizen_id
      INNER JOIN [User]         U  ON U.user_id     = C.user_id
      INNER JOIN Disaster_Event DE ON DE.event_id   = ER.disaster_event_id
      LEFT JOIN (
        SELECT report_id, COUNT(*) AS teams_assigned
        FROM   Team_Assignment
        WHERE  status IN ('Active','Pending')
        GROUP BY report_id
      ) TA ON TA.report_id = ER.report_id
      ${where}
      ORDER BY
        CASE ER.severity_level
          WHEN 'Critical' THEN 1
          WHEN 'High'     THEN 2
          WHEN 'Medium'   THEN 3
          ELSE 4
        END,
        ER.report_time DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/field — field officer view (uses view) ──
router.get('/field', authorize('Rescue_Operator', 'Disaster_Coordinator', 'System_Admin'), async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request().query(`
      SELECT * FROM vw_FieldOfficer_ActiveReports
      ORDER BY
        CASE severity_level WHEN 'Critical' THEN 1 WHEN 'High' THEN 2 WHEN 'Medium' THEN 3 ELSE 4 END,
        minutes_since_report DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/reports/:id ──────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT ER.*, C.full_name AS citizen_name, U.phone AS citizen_phone,
               DE.event_name, DE.disaster_type AS event_type
        FROM   Emergency_Report ER
        INNER JOIN Citizen        C  ON C.citizen_id = ER.citizen_id
        INNER JOIN [User]         U  ON U.user_id    = C.user_id
        INNER JOIN Disaster_Event DE ON DE.event_id  = ER.disaster_event_id
        WHERE  ER.report_id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ error: 'Report not found' });
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/reports — submit emergency report ───────────────
router.post('/', authorize('Citizen'), async (req, res) => {
  const { disaster_event_id, location, latitude, longitude,
          disaster_type, severity_level, description } = req.body;

  if (!disaster_event_id || !location || !disaster_type || !severity_level || !description)
    return res.status(400).json({ error: 'All fields required' });

  try {
    const pool = await getPool();

    // Resolve citizen_id from logged-in user
    const citizenRes = await pool.request()
      .input('uid', sql.Int, req.user.user_id)
      .query('SELECT citizen_id FROM Citizen WHERE user_id = @uid');

    if (!citizenRes.recordset.length)
      return res.status(400).json({ error: 'User has no citizen profile' });

    const citizen_id = citizenRes.recordset[0].citizen_id;

    const result = await pool.request()
      .input('citizen_id',        sql.Int,          citizen_id)
      .input('disaster_event_id', sql.Int,          disaster_event_id)
      .input('location',          sql.VarChar,      location)
      .input('latitude',          sql.Decimal(9,6), latitude  || 0)
      .input('longitude',         sql.Decimal(9,6), longitude || 0)
      .input('disaster_type',     sql.VarChar,      disaster_type)
      .input('severity_level',    sql.VarChar,      severity_level)
      .input('description',       sql.Text,         description)
      .query(`
        DECLARE @insertedReports TABLE (report_id INT);

        INSERT INTO Emergency_Report
          (citizen_id, disaster_event_id, location, latitude, longitude,
           disaster_type, severity_level, report_time, status, description)
        OUTPUT INSERTED.report_id INTO @insertedReports
        VALUES
          (@citizen_id, @disaster_event_id, @location, @latitude, @longitude,
           @disaster_type, @severity_level, GETDATE(), 'Active', @description);

        SELECT report_id FROM @insertedReports;
      `);
    res.status(201).json({ report_id: result.recordset[0].report_id, message: 'Report submitted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/reports/:id/status ────────────────────────────
router.patch('/:id/status',
  authorize('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'),
  async (req, res) => {
    const { status } = req.body;
    const allowed = ['Active', 'Pending', 'Completed', 'Inactive'];
    if (!allowed.includes(status))
      return res.status(400).json({ error: 'Invalid status value' });

    try {
      const pool = await getPool();
      await pool.request()
        .input('id',     sql.Int,     req.params.id)
        .input('status', sql.VarChar, status)
        .query('UPDATE Emergency_Report SET status = @status WHERE report_id = @id');
      res.json({ message: 'Status updated' });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  }
);

module.exports = router;
