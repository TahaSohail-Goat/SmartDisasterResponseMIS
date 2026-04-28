// ============================================================
// routes/finance.js
// ============================================================
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const financeRouter = express.Router();
financeRouter.use(authenticate);

// GET /api/finance/summary — via vw_FinanceOfficer_Summary
financeRouter.get('/summary', authorize('System_Admin', 'Finance_Officer', 'Disaster_Coordinator'), async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT * FROM vw_FinanceOfficer_Summary ORDER BY net_balance DESC
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// GET /api/finance/transactions
financeRouter.get('/transactions', authorize('System_Admin', 'Finance_Officer'), async (req, res) => {
    try {
        const { type, event_id } = req.query;
        const pool = await getPool();
        const request = pool.request();
        let where = 'WHERE 1=1';
        if (type) { request.input('type', sql.VarChar, type); where += ' AND transaction_type = @type'; }
        if (event_id) { request.input('event_id', sql.Int, event_id); where += ' AND disaster_event_id = @event_id'; }
        const result = await request.query(`
      SELECT FT.*, U.username AS recorded_by_name, DE.event_name
      FROM   Financial_Transaction FT
      INNER JOIN [User]         U  ON U.user_id  = FT.recorded_by
      INNER JOIN Disaster_Event DE ON DE.event_id = FT.disaster_event_id
      ${where}
      ORDER BY transaction_date DESC
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/finance/donations — record donation (Transaction 2)
financeRouter.post('/donations', authorize('System_Admin', 'Finance_Officer'), async (req, res) => {
    const { citizen_id, disaster_event_id, donor_name, donor_type,
        amount, payment_method, transaction_reference } = req.body;

    const pool = await getPool();
    const tx = new (require('mssql').Transaction)(await pool);

    try {
        await tx.begin();

        const r1 = new (require('mssql').Request)(tx);
        const don = await r1
            .input('citizen_id', sql.Int, citizen_id)
            .input('disaster_event_id', sql.Int, disaster_event_id)
            .input('donor_name', sql.VarChar, donor_name)
            .input('donor_type', sql.VarChar, donor_type)
            .input('amount', sql.Decimal(15, 2), amount)
            .input('payment_method', sql.VarChar, payment_method)
            .input('transaction_reference', sql.VarChar, transaction_reference)
            .query(`
        INSERT INTO Donation
          (citizen_id, disaster_event_id, donor_name, donor_type,
           amount, donation_date, payment_method, transaction_reference)
        OUTPUT INSERTED.donation_id
        VALUES (@citizen_id, @disaster_event_id, @donor_name, @donor_type,
                @amount, GETDATE(), @payment_method, @transaction_reference)
      `);

        const donation_id = don.recordset[0].donation_id;

        const r2 = new (require('mssql').Request)(tx);
        await r2
            .input('ref_id', sql.Int, donation_id)
            .input('event_id', sql.Int, disaster_event_id)
            .input('amount2', sql.Decimal(15, 2), amount)
            .input('rec_by', sql.Int, req.user.user_id)
            .input('note', sql.VarChar, `Donation from ${donor_name}`)
            .query(`
        INSERT INTO Financial_Transaction
          (transaction_type, reference_id, disaster_event_id, amount, transaction_date, recorded_by, notes)
        VALUES ('Donation', @ref_id, @event_id, @amount2, GETDATE(), @rec_by, @note)
      `);

        await tx.commit();
        res.status(201).json({ donation_id, message: 'Donation recorded' });
    } catch (err) {
        await tx.rollback();
        res.status(400).json({ error: err.message });
    }
});

// POST /api/finance/expenses — record expense + financial transaction (Transaction 3)
financeRouter.post('/expenses', authorize('System_Admin', 'Finance_Officer'), async (req, res) => {
    const { disaster_event_id, category, amount, description } = req.body;
    if (!disaster_event_id || !category || !amount || !description) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    const pool = await getPool();
    const tx = new (require('mssql').Transaction)(await pool);

    try {
        await tx.begin();

        // 1) Insert into Expense table
        const r1 = new (require('mssql').Request)(tx);
        const expResult = await r1
            .input('event_id', sql.Int, disaster_event_id)
            .input('category', sql.VarChar, category)
            .input('amount', sql.Decimal(15, 2), amount)
            .input('description', sql.Text, description)
            .input('recorded_by', sql.Int, req.user.user_id)
            .query(`
                INSERT INTO Expense
                  (disaster_event_id, category, amount, description, expense_date, recorded_by, approval_status)
                OUTPUT INSERTED.expense_id
                VALUES (@event_id, @category, @amount, @description, GETDATE(), @recorded_by, 'Pending')
            `);

        const expense_id = expResult.recordset[0].expense_id;

        // 2) Also insert into Financial_Transaction so it shows in the ledger
        const r2 = new (require('mssql').Request)(tx);
        await r2
            .input('ref_id', sql.Int, expense_id)
            .input('event_id2', sql.Int, disaster_event_id)
            .input('amount2', sql.Decimal(15, 2), amount)
            .input('rec_by', sql.Int, req.user.user_id)
            .input('note', sql.VarChar, `Expense: ${category} — ${description.substring(0, 200)}`)
            .query(`
                INSERT INTO Financial_Transaction
                  (transaction_type, reference_id, disaster_event_id, amount, transaction_date, recorded_by, notes)
                VALUES ('Expense', @ref_id, @event_id2, @amount2, GETDATE(), @rec_by, @note)
            `);

        await tx.commit();
        res.status(201).json({ expense_id, message: 'Expense recorded successfully' });
    } catch (err) {
        await tx.rollback();
        res.status(400).json({ error: err.message });
    }
});

module.exports.financeRouter = financeRouter;