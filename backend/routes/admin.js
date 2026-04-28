// routes/admin.js — audit log + approvals (Admin/Coordinator only)
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const adminRouter = express.Router();
adminRouter.use(authenticate);

// ── GET /api/admin/audit ─────────────────────────────────────
// Returns recent audit trail via the DB view (System_Admin only)
adminRouter.get('/audit', authorize('System_Admin'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT TOP 200
        AL.log_id,
        AL.[timestamp],
        U.username       AS actor,
        R.role_name      AS actor_role,
        AL.action,
        AL.table_name,
        AL.record_id,
        AL.old_value,
        AL.new_value,
        AL.ip_address
      FROM Audit_Log AL
      INNER JOIN [User] U ON U.user_id = AL.user_id
      INNER JOIN Role   R ON R.role_id = U.role_id
      ORDER BY AL.[timestamp] DESC
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ── GET /api/admin/approvals ─────────────────────────────────
// Returns all approval requests
adminRouter.get('/approvals',
    authorize('System_Admin', 'Disaster_Coordinator', 'Finance_Officer', 'Warehouse_Manager'),
    async (req, res) => {
        try {
            const pool = await getPool();
            const { status } = req.query;
            const request = pool.request();
            let where = 'WHERE 1=1';
            if (status) { request.input('status', sql.VarChar, status); where += ' AND AR.status = @status'; }
            const result = await request.query(`
        SELECT
          AR.request_id,
          AR.request_type,
          AR.allocation_id,
          AR.requested_by,
          AR.approved_by,
          AR.status,
          AR.request_date,
          AR.resolved_date,
          AR.remarks,
          U.username        AS requester_name,
          R.role_name       AS requester_role,
          UA.username       AS approver_name
        FROM Approval_Request AR
        INNER JOIN [User] U  ON U.user_id  = AR.requested_by
        INNER JOIN Role   R  ON R.role_id  = U.role_id
        LEFT  JOIN [User] UA ON UA.user_id = AR.approved_by
        ${where}
        ORDER BY AR.request_date DESC
      `);
            res.json(result.recordset);
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

// ── PATCH /api/admin/approvals/:id ───────────────────────────
// Approve or Reject a request
adminRouter.patch('/approvals/:id',
    authorize('System_Admin', 'Disaster_Coordinator', 'Finance_Officer', 'Warehouse_Manager'),
    async (req, res) => {
        const { status, notes } = req.body;
        if (!['Approved', 'Rejected'].includes(status))
            return res.status(400).json({ error: 'status must be Approved or Rejected' });
        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('id',          sql.Int,    req.params.id)
                .input('status',      sql.VarChar, status)
                .input('approved_by', sql.Int,     req.user.user_id)
                .input('remarks',     sql.Text,    notes || null)
                .query(`
          UPDATE Approval_Request
          SET status        = @status,
              approved_by   = @approved_by,
              resolved_date = GETDATE(),
              remarks       = ISNULL(@remarks, remarks)
          WHERE request_id  = @id
          AND   status      = 'Pending';

          SELECT @@ROWCOUNT AS updated;
        `);
            const updated = result.recordset?.[0]?.updated ?? result.rowsAffected?.[0] ?? 0;
            if (!updated) return res.status(409).json({ error: 'Request not found or already decided' });
            res.json({ message: `Request ${status}` });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

// ── GET /api/admin/stats ─────────────────────────────────────
// Admin dashboard quick-stats via vw_Admin_SystemOverview
adminRouter.get('/stats', authorize('System_Admin'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`SELECT * FROM vw_Admin_SystemOverview`);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports.adminRouter = adminRouter;
