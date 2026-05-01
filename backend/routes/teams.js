// routes/teams.js — Rescue Teams + Assignments
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const router = express.Router();
router.use(authenticate);

// GET /api/teams
router.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT team_id, team_name, team_type, current_location,
             availability_status, team_size, contact_number
      FROM   Rescue_Team
      ORDER BY availability_status, team_name
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/teams/assign — assign team to report (wraps Transaction 1 logic)
router.post('/assign', authorize('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'), async (req, res) => {
    const { rescue_team_id, report_id, notes } = req.body;
    if (!rescue_team_id || !report_id)
        return res.status(400).json({ error: 'rescue_team_id and report_id required' });

    try {
        const pool = await getPool();

        // Check team is available
        const check = await pool.request()
            .input('tid', sql.Int, rescue_team_id)
            .query(`SELECT availability_status FROM Rescue_Team WHERE team_id = @tid`);

        if (!check.recordset.length) return res.status(404).json({ error: 'Team not found' });
        if (check.recordset[0].availability_status !== 'Available')
            return res.status(409).json({ error: `Team is not available (${check.recordset[0].availability_status})` });

        const result = await pool.request()
            .input('rescue_team_id', sql.Int, rescue_team_id)
            .input('report_id', sql.Int, report_id)
            .input('notes', sql.Text, notes || null)
            .query(`
        DECLARE @insertedAssignments TABLE (assignment_id INT);

        INSERT INTO Team_Assignment (rescue_team_id, report_id, assigned_at, status, notes)
        OUTPUT INSERTED.assignment_id INTO @insertedAssignments
        VALUES (@rescue_team_id, @report_id, GETDATE(), 'Active', @notes);

        SELECT assignment_id FROM @insertedAssignments;
      `);
        // TRG-01 fires here → sets team Busy automatically
        res.status(201).json({ assignment_id: result.recordset[0].assignment_id, message: 'Team assigned' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/deployment-requests', authorize('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'), async (req, res) => {
    const { rescue_team_id, report_id, notes } = req.body;
    if (!rescue_team_id || !report_id)
        return res.status(400).json({ error: 'rescue_team_id and report_id required' });

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();

        const check = await new sql.Request(tx)
            .input('tid', sql.Int, rescue_team_id)
            .query(`SELECT availability_status FROM Rescue_Team WITH (UPDLOCK, ROWLOCK) WHERE team_id = @tid`);

        if (!check.recordset.length) {
            await tx.rollback();
            return res.status(404).json({ error: 'Team not found' });
        }
        if (check.recordset[0].availability_status !== 'Available') {
            await tx.rollback();
            return res.status(409).json({ error: `Team is not available (${check.recordset[0].availability_status})` });
        }

        const assignment = await new sql.Request(tx)
            .input('rescue_team_id', sql.Int, rescue_team_id)
            .input('report_id', sql.Int, report_id)
            .input('notes', sql.Text, notes || null)
            .query(`
              DECLARE @insertedAssignments TABLE (assignment_id INT);

              INSERT INTO Team_Assignment (rescue_team_id, report_id, assigned_at, status, notes)
              OUTPUT INSERTED.assignment_id INTO @insertedAssignments
              VALUES (@rescue_team_id, @report_id, GETDATE(), 'Pending', @notes);

              SELECT assignment_id FROM @insertedAssignments;
            `);

        const assignmentId = assignment.recordset[0].assignment_id;

        await new sql.Request(tx)
            .input('requested_by', sql.Int, req.user.user_id)
            .input('assignment_id', sql.Int, assignmentId)
            .input('remarks', sql.Text, notes || 'Rescue deployment awaiting approval')
            .query(`
              INSERT INTO Approval_Request
                (request_type, requested_by, approved_by, allocation_id, procurement_id, assignment_id,
                 status, request_date, resolved_date, remarks)
              VALUES
                ('Team_Assignment', @requested_by, NULL, NULL, NULL, @assignment_id,
                 'Pending', GETDATE(), NULL, @remarks)
            `);

        await tx.commit();
        res.status(201).json({ assignment_id: assignmentId, message: 'Deployment request created' });
    } catch (err) {
        try { await tx.rollback(); } catch { /* closed */ }
        res.status(500).json({ error: err.message });
    }
});

// PATCH /api/teams/:id/on-scene — mark an Assigned team as Busy (on-scene)
router.patch('/:id/on-scene', authorize('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'), async (req, res) => {
    try {
        const pool = await getPool();

        // Verify team is currently 'Assigned'
        const check = await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`SELECT team_id, availability_status FROM Rescue_Team WHERE team_id = @id`);

        if (!check.recordset.length) return res.status(404).json({ error: 'Team not found' });
        if (check.recordset[0].availability_status !== 'Assigned')
            return res.status(409).json({ error: `Team is not in Assigned state (currently: ${check.recordset[0].availability_status})` });

        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`UPDATE Rescue_Team SET availability_status = 'Busy' WHERE team_id = @id`);

        // Audit log
        await pool.request()
            .input('user_id', sql.Int, req.user.user_id)
            .input('record_id', sql.Int, req.params.id)
            .query(`
                INSERT INTO Audit_Log (user_id, action, table_name, record_id, old_value, new_value, ip_address)
                VALUES (@user_id, 'UPDATE', 'Rescue_Team', @record_id,
                    '{"availability_status":"Assigned"}',
                    '{"availability_status":"Busy"}',
                    'API')
            `);

        res.json({ message: 'Team is now on-scene (Busy)' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// PATCH /api/teams/assignments/:id/complete
router.patch('/assignments/:id/complete', authorize('System_Admin', 'Disaster_Coordinator', 'Rescue_Operator'), async (req, res) => {
    try {
        const pool = await getPool();
        await pool.request()
            .input('id', sql.Int, req.params.id)
            .query(`UPDATE Team_Assignment SET status='Completed', completed_at=GETDATE() WHERE assignment_id=@id`);
        // TRG-02 fires here → frees the team
        res.json({ message: 'Assignment completed, team freed' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
