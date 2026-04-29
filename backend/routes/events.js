// routes/events.js — Disaster Events CRUD
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();
router.use(authenticate);

// ── GET /api/events — all events (all roles) ─────────────────
router.get('/', async (req, res) => {
  try {
    const { status, type } = req.query;
    const pool = await getPool();
    const request = pool.request();

    let where = 'WHERE 1=1';
    if (status) { request.input('status', sql.VarChar, status); where += ' AND status = @status'; }
    if (type)   { request.input('type',   sql.VarChar, type);   where += ' AND disaster_type = @type'; }

    const result = await request.query(`
      SELECT event_id, event_name, disaster_type, location,
             severity_level, status, start_date, end_date, description
      FROM   Disaster_Event
      ${where}
      ORDER BY start_date DESC
    `);
    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/events/:id — single event with stats ────────────
router.get('/:id', async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT event_id, event_name, disaster_type, location,
               severity_level, status, start_date, end_date, description
        FROM   Disaster_Event
        WHERE  event_id = @id
      `);
    if (!result.recordset.length) return res.status(404).json({ error: 'Event not found' });

    // Also return summary stats from the admin view
    const stats = await pool.request()
      .input('id2', sql.Int, req.params.id)
      .query(`
        SELECT total_reports, active_reports, total_team_assignments,
               total_patients, total_donations, total_expenses, net_balance
        FROM   vw_Admin_SystemOverview
        WHERE  event_id = @id2
      `);

    res.json({ ...result.recordset[0], stats: stats.recordset[0] || {} });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/events — create (Coordinator, Admin) ───────────
router.post('/', authorize('System_Admin', 'Disaster_Coordinator'), async (req, res) => {
  const { event_name, disaster_type, location, severity_level, description } = req.body;
  if (!event_name || !disaster_type || !location || !severity_level || !description)
    return res.status(400).json({ error: 'All fields required' });

  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('event_name',    sql.VarChar, event_name)
      .input('disaster_type', sql.VarChar, disaster_type)
      .input('location',      sql.VarChar, location)
      .input('severity_level',sql.VarChar, severity_level)
      .input('description',   sql.Text,    description)
      .query(`
        INSERT INTO Disaster_Event
          (event_name, disaster_type, location, severity_level, start_date, status, description)
        OUTPUT INSERTED.event_id
        VALUES (@event_name, @disaster_type, @location, @severity_level, GETDATE(), 'Active', @description)
      `);
    res.status(201).json({ event_id: result.recordset[0].event_id, message: 'Event created' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/events/:id/close — close event (Admin only) ───
router.patch('/:id/close', authorize('System_Admin'), async (req, res) => {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin();

    const eventResult = await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .query(`
        SELECT event_id, event_name, status
        FROM Disaster_Event WITH (UPDLOCK, ROWLOCK)
        WHERE event_id = @id
      `);

    if (!eventResult.recordset.length) {
      await tx.rollback();
      return res.status(404).json({ error: 'Event not found' });
    }

    const event = eventResult.recordset[0];
    if (['Completed', 'Inactive'].includes(event.status)) {
      await tx.rollback();
      return res.status(409).json({ error: `Event is already closed (${event.status})` });
    }

    await new sql.Request(tx)
      .input('id', sql.Int, req.params.id)
      .query(`
        UPDATE Disaster_Event
        SET status = 'Completed', end_date = GETDATE()
        WHERE event_id = @id;

        UPDATE TA
        SET TA.status = 'Completed',
            TA.completed_at = COALESCE(TA.completed_at, GETDATE())
        FROM Team_Assignment TA
        INNER JOIN Emergency_Report ER ON ER.report_id = TA.report_id
        WHERE ER.disaster_event_id = @id
        AND TA.status IN ('Active', 'Pending');

        UPDATE RT
        SET RT.availability_status = 'Available'
        FROM Rescue_Team RT
        WHERE RT.team_id IN (
          SELECT DISTINCT TA.rescue_team_id
          FROM Team_Assignment TA
          INNER JOIN Emergency_Report ER ON ER.report_id = TA.report_id
          WHERE ER.disaster_event_id = @id
        )
        AND NOT EXISTS (
          SELECT 1
          FROM Team_Assignment OpenTA
          WHERE OpenTA.rescue_team_id = RT.team_id
          AND OpenTA.status IN ('Active', 'Pending')
        );

        UPDATE RA
        SET RA.status = 'Completed'
        FROM Resource_Allocation RA
        INNER JOIN Emergency_Report ER ON ER.report_id = RA.report_id
        WHERE ER.disaster_event_id = @id
        AND RA.status IN ('Active', 'Pending');

        UPDATE AR
        SET AR.status = 'Rejected',
            AR.resolved_date = GETDATE(),
            AR.remarks = COALESCE(CAST(AR.remarks AS VARCHAR(MAX)) + ' | ', '') + 'Lapsed because parent event was closed.'
        FROM Approval_Request AR
        INNER JOIN Resource_Allocation RA ON RA.allocation_id = AR.allocation_id
        INNER JOIN Emergency_Report ER ON ER.report_id = RA.report_id
        WHERE ER.disaster_event_id = @id
        AND AR.status = 'Pending';
      `);

    await new sql.Request(tx)
      .input('user_id', sql.Int, req.user.user_id)
      .input('record_id', sql.Int, req.params.id)
      .input('old_value', sql.NVarChar(sql.MAX), JSON.stringify({ status: event.status }))
      .input('new_value', sql.NVarChar(sql.MAX), JSON.stringify({ status: 'Completed' }))
      .input('ip', sql.VarChar, req.ip || null)
      .query(`
        INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
        VALUES (@user_id, 'UPDATE', 'Disaster_Event', @record_id, @old_value, @new_value, @ip)
      `);

    await tx.commit();
    res.json({ message: 'Event closed successfully' });
  } catch (err) {
    try { await tx.rollback(); } catch { /* transaction may already be closed */ }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
