// routes/admin.js — audit log + approvals (Admin/Coordinator only)
const express = require('express');
const bcrypt = require('bcryptjs');
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

// ── Role → Allowed request types mapping ─────────────────────
// Each role only sees the request types they are authorized to approve
const ROLE_APPROVAL_SCOPE = {
    System_Admin:        null, // sees everything
    Finance_Officer:     ['Procurement'],
    Warehouse_Manager:   ['Resource_Allocation'],
    Disaster_Coordinator:['Team_Assignment'],
};

// ── GET /api/admin/approvals ─────────────────────────────────
// Returns only the approval requests the current user's role can review
adminRouter.get('/approvals',
    authorize('System_Admin', 'Disaster_Coordinator', 'Finance_Officer', 'Warehouse_Manager'),
    async (req, res) => {
        try {
            const pool = await getPool();
            const { status } = req.query;
            const request = pool.request();
            let where = 'WHERE 1=1';
            if (status) { request.input('status', sql.VarChar, status); where += ' AND AR.status = @status'; }

            // Scope by role: only show request types this role can approve
            const allowedTypes = ROLE_APPROVAL_SCOPE[req.user.role];
            if (allowedTypes) {
                const typeList = allowedTypes.map((t, i) => { request.input(`rt${i}`, sql.VarChar, t); return `@rt${i}`; }).join(',');
                where += ` AND AR.request_type IN (${typeList})`;
            }

            const result = await request.query(`
        SELECT
          AR.request_id,
          AR.request_type,
          AR.allocation_id,
          AR.procurement_id,
          AR.assignment_id,
          AR.requested_by,
          AR.approved_by,
          AR.status,
          AR.request_date,
          AR.request_date    AS request_time,
          AR.resolved_date,
          AR.resolved_date   AS decision_time,
          AR.remarks,
          AR.remarks         AS notes,
          U.username        AS requester_name,
          R.role_name       AS requester_role,
          UA.username       AS approver_name,
          PR.supplier_name  AS procurement_supplier,
          RT.team_name      AS assignment_team_name
        FROM Approval_Request AR
        INNER JOIN [User] U  ON U.user_id  = AR.requested_by
        INNER JOIN Role   R  ON R.role_id  = U.role_id
        LEFT  JOIN [User] UA ON UA.user_id = AR.approved_by
        LEFT  JOIN Procurement PR ON PR.procurement_id = AR.procurement_id
        LEFT  JOIN Team_Assignment TA ON TA.assignment_id = AR.assignment_id
        LEFT  JOIN Rescue_Team RT ON RT.team_id = TA.rescue_team_id
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
        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            const current = await new sql.Request(tx)
                .input('id', sql.Int, req.params.id)
                .query(`
          SELECT
            AR.request_id,
            AR.request_type,
            AR.status,
            AR.allocation_id,
            AR.procurement_id,
            AR.assignment_id,
            RA.inventory_id,
            RA.allocated_quantity,
            RA.dispatched_quantity,
            P.disaster_event_id,
            P.quantity AS procurement_quantity,
            P.unit_cost AS procurement_unit_cost,
            TA.rescue_team_id
          FROM Approval_Request AR WITH (UPDLOCK, ROWLOCK)
          LEFT JOIN Resource_Allocation RA ON RA.allocation_id = AR.allocation_id
          LEFT JOIN Procurement P ON P.procurement_id = AR.procurement_id
          LEFT JOIN Team_Assignment TA ON TA.assignment_id = AR.assignment_id
          WHERE AR.request_id = @id
        `);

            if (!current.recordset.length) {
                await tx.rollback();
                return res.status(404).json({ error: 'Request not found' });
            }

            const request = current.recordset[0];
            if (request.status !== 'Pending') {
                await tx.rollback();
                return res.status(409).json({ error: 'Request already decided' });
            }

            // ── Separation of duties: requester cannot approve their own request ──
            if (request.requested_by === req.user.user_id) {
                await tx.rollback();
                return res.status(403).json({
                    error: 'You cannot approve or reject your own request. Another authorized user must review it.'
                });
            }

            // ── Role-scope check: only the correct role can approve each type ──
            const allowedTypes = ROLE_APPROVAL_SCOPE[req.user.role];
            if (allowedTypes && !allowedTypes.includes(request.request_type)) {
                await tx.rollback();
                return res.status(403).json({
                    error: `Your role (${req.user.role}) is not authorized to approve ${request.request_type} requests.`
                });
            }

            await new sql.Request(tx)
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
        `);

            if (request.request_type === 'Resource_Allocation') {
                if (status === 'Approved') {
                    await new sql.Request(tx)
                        .input('allocation_id', sql.Int, request.allocation_id)
                        .query(`
              UPDATE Resource_Allocation
              SET dispatched_quantity = allocated_quantity,
                  status = 'Active'
              WHERE allocation_id = @allocation_id
              AND status = 'Pending'
            `);
                } else {
                    await new sql.Request(tx)
                        .input('allocation_id', sql.Int, request.allocation_id)
                        .query(`
              UPDATE Resource_Allocation
              SET status = 'Inactive'
              WHERE allocation_id = @allocation_id
              AND status = 'Pending'
            `);
                }
            }

            if (request.request_type === 'Procurement') {
                if (status === 'Approved') {
                    await new sql.Request(tx)
                        .input('procurement_id', sql.Int, request.procurement_id)
                        .input('approved_by', sql.Int, req.user.user_id)
                        .query(`
              UPDATE Procurement
              SET status = 'Completed',
                  approved_by = @approved_by
              WHERE procurement_id = @procurement_id
              AND status = 'Pending'
            `);

                    await new sql.Request(tx)
                        .input('ref_id', sql.Int, request.procurement_id)
                        .input('event_id', sql.Int, request.disaster_event_id)
                        .input('amount', sql.Decimal(15, 2), request.procurement_quantity * request.procurement_unit_cost)
                        .input('recorded_by', sql.Int, req.user.user_id)
                        .input('notes', sql.Text, `Procurement #${request.procurement_id} approved through workflow`)
                        .query(`
              INSERT INTO Financial_Transaction
                (transaction_type, reference_id, disaster_event_id, amount, transaction_date, recorded_by, notes)
              VALUES
                ('Procurement', @ref_id, @event_id, @amount, GETDATE(), @recorded_by, @notes)
            `);
                } else {
                    await new sql.Request(tx)
                        .input('procurement_id', sql.Int, request.procurement_id)
                        .query(`
              UPDATE Procurement
              SET status = 'Inactive'
              WHERE procurement_id = @procurement_id
              AND status = 'Pending'
            `);
                }
            }

            if (request.request_type === 'Team_Assignment') {
                if (status === 'Approved') {
                    await new sql.Request(tx)
                        .input('assignment_id', sql.Int, request.assignment_id)
                        .input('team_id', sql.Int, request.rescue_team_id)
                        .query(`
              UPDATE Team_Assignment
              SET status = 'Active'
              WHERE assignment_id = @assignment_id
              AND status = 'Pending';

              UPDATE Rescue_Team
              SET availability_status = 'Busy'
              WHERE team_id = @team_id;
            `);
                } else {
                    await new sql.Request(tx)
                        .input('assignment_id', sql.Int, request.assignment_id)
                        .query(`
              UPDATE Team_Assignment
              SET status = 'Inactive',
                  completed_at = GETDATE()
              WHERE assignment_id = @assignment_id
              AND status = 'Pending'
            `);
                }
            }

            await tx.commit();
            res.json({ message: `Request ${status}` });
        } catch (err) {
            try { await tx.rollback(); } catch { /* transaction may already be closed */ }
            res.status(500).json({ error: err.message });
        }
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

adminRouter.get('/roles', authorize('System_Admin'), async (_req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT role_id, role_name, description, created_at
          FROM Role
          ORDER BY role_id
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

adminRouter.get('/users', authorize('System_Admin'), async (_req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
          SELECT
            U.user_id,
            U.username,
            U.email,
            U.phone,
            U.is_active,
            U.created_at,
            U.role_id,
            R.role_name
          FROM [User] U
          INNER JOIN Role R ON R.role_id = U.role_id
          ORDER BY U.created_at DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

adminRouter.post('/users', authorize('System_Admin'), async (req, res) => {
    const { username, password, email, phone, role_id, is_active = true } = req.body;
    if (!username || !password || !email || !phone || !role_id) {
        return res.status(400).json({ error: 'username, password, email, phone, and role_id are required' });
    }

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();
        const hash = await bcrypt.hash(password, 12);
        const result = await new sql.Request(tx)
            .input('username', sql.VarChar, username)
            .input('hash', sql.Text, hash)
            .input('email', sql.VarChar, email)
            .input('phone', sql.VarChar, phone)
            .input('is_active', sql.Bit, is_active ? 1 : 0)
            .input('role_id', sql.Int, role_id)
            .query(`
              INSERT INTO [User] (username, password_hash, email, phone, is_active, role_id)
              OUTPUT INSERTED.user_id
              VALUES (@username, @hash, @email, @phone, @is_active, @role_id)
            `);

        const userId = result.recordset[0].user_id;
        await new sql.Request(tx)
            .input('user_id', sql.Int, userId)
            .input('role_id', sql.Int, role_id)
            .query('INSERT INTO User_Role (user_id, role_id) VALUES (@user_id, @role_id)');

        await tx.commit();
        res.status(201).json({ user_id: userId, message: 'User created' });
    } catch (err) {
        try { await tx.rollback(); } catch { /* closed */ }
        res.status(400).json({ error: err.message });
    }
});

adminRouter.patch('/users/:id', authorize('System_Admin'), async (req, res) => {
    const { username, email, phone, role_id, is_active } = req.body;

    const pool = await getPool();
    const tx = new sql.Transaction(pool);

    try {
        await tx.begin();
        const result = await new sql.Request(tx)
            .input('id', sql.Int, req.params.id)
            .input('username', sql.VarChar, username || null)
            .input('email', sql.VarChar, email || null)
            .input('phone', sql.VarChar, phone || null)
            .input('role_id', sql.Int, role_id || null)
            .input('is_active', sql.Bit, typeof is_active === 'boolean' ? (is_active ? 1 : 0) : null)
            .query(`
              UPDATE [User]
              SET username = COALESCE(@username, username),
                  email = COALESCE(@email, email),
                  phone = COALESCE(@phone, phone),
                  role_id = COALESCE(@role_id, role_id),
                  is_active = COALESCE(@is_active, is_active)
              WHERE user_id = @id;

              SELECT @@ROWCOUNT AS updated;
            `);

        if (!result.recordset[0].updated) {
            await tx.rollback();
            return res.status(404).json({ error: 'User not found' });
        }

        if (role_id) {
            await new sql.Request(tx)
                .input('user_id', sql.Int, req.params.id)
                .input('role_id', sql.Int, role_id)
                .query(`
                  IF NOT EXISTS (SELECT 1 FROM User_Role WHERE user_id = @user_id AND role_id = @role_id)
                    INSERT INTO User_Role (user_id, role_id) VALUES (@user_id, @role_id)
                `);
        }

        await tx.commit();
        res.json({ message: 'User updated' });
    } catch (err) {
        try { await tx.rollback(); } catch { /* closed */ }
        res.status(400).json({ error: err.message });
    }
});

adminRouter.patch('/users/:id/password', authorize('System_Admin'), async (req, res) => {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'password is required' });

    try {
        const hash = await bcrypt.hash(password, 12);
        const pool = await getPool();
        const result = await pool.request()
            .input('id', sql.Int, req.params.id)
            .input('hash', sql.Text, hash)
            .query('UPDATE [User] SET password_hash = @hash WHERE user_id = @id');

        if (!result.rowsAffected[0]) return res.status(404).json({ error: 'User not found' });
        res.json({ message: 'Password updated' });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports.adminRouter = adminRouter;
