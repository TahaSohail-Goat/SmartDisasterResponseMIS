// routes/auth.js — login + current user
const express = require('express');
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { getPool, sql } = require('../db');
const { authenticate }  = require('../middleware/auth');

const router = express.Router();

// ── POST /api/auth/login ─────────────────────────────────────
router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ error: 'Username and password required' });

  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('username', sql.VarChar, username)
      .query(`
        SELECT u.user_id, u.username, CAST(u.password_hash AS VARCHAR(MAX)) AS password_hash,
               u.email, u.is_active, r.role_name
        FROM   [User] u
        INNER JOIN Role r ON r.role_id = u.role_id
        WHERE  u.username = @username
      `);

    const user = result.recordset[0];
    if (!user)
      return res.status(401).json({ error: 'Invalid credentials' });

    if (!user.is_active)
      return res.status(403).json({ error: 'Account is disabled' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid)
      return res.status(401).json({ error: 'Invalid credentials' });

    const secret = process.env.JWT_SECRET;
    if (!secret) return res.status(500).json({ error: 'JWT_SECRET is not configured' });

    const token = jwt.sign(
      { user_id: user.user_id, username: user.username, role: user.role_name },
      secret,
      { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
    );

    res.json({
      token,
      user: {
        user_id:  user.user_id,
        username: user.username,
        email:    user.email,
        role:     user.role_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ── POST /api/auth/signup ────────────────────────────────────
router.post('/signup', async (req, res) => {
  const { username, password, email, phone, full_name, cnic, address, date_of_birth, gender } = req.body;

  if (!username || !password || !email || !full_name || !cnic || !phone || !address || !date_of_birth) {
    return res.status(400).json({ error: 'All fields (including address and date of birth) are required' });
  }

  try {
    const pool = await getPool();
    
    // Check if user already exists
    const existing = await pool.request()
      .input('username', sql.VarChar, username)
      .input('email', sql.VarChar, email)
      .input('cnic', sql.VarChar, cnic)
      .query(`
        SELECT 1 FROM [User] WHERE username = @username OR email = @email
        UNION ALL
        SELECT 1 FROM Citizen WHERE cnic = @cnic
      `);

    if (existing.recordset.length > 0) {
      return res.status(409).json({ error: 'Username, email, or CNIC already exists' });
    }

    const roleRes = await pool.request()
      .input('role', sql.VarChar, 'Citizen')
      .query('SELECT role_id FROM Role WHERE role_name = @role');

    if (!roleRes.recordset.length) {
      return res.status(500).json({ error: 'Citizen role is missing from the database' });
    }

    const citizenRoleId = roleRes.recordset[0].role_id;
    const hash = await bcrypt.hash(password, 12);
    
    // Begin transaction since we are inserting into 2 tables
    const tx = new sql.Transaction(pool);
    await tx.begin();

    try {
      // Citizen Role is role_id 6
      const userReq = new sql.Request(tx);
      const userResult = await userReq
        .input('username', sql.VarChar, username)
        .input('hash', sql.Text, hash)
        .input('email', sql.VarChar, email)
        .input('phone', sql.VarChar, phone)
        .input('role_id', sql.Int, citizenRoleId)
        .query(`
          INSERT INTO [User] (username, password_hash, email, phone, is_active, role_id)
          OUTPUT INSERTED.user_id
          VALUES (@username, @hash, @email, @phone, 1, @role_id)
        `);

      const userId = userResult.recordset[0].user_id;

      const citizenReq = new sql.Request(tx);
      await citizenReq
        .input('user_id', sql.Int, userId)
        .input('full_name', sql.VarChar, full_name)
        .input('cnic', sql.VarChar, cnic)
        .input('address', sql.VarChar, address)
        .input('dob', sql.Date, date_of_birth)
        .input('gender', sql.VarChar, gender || 'Other')
        .query(`
          INSERT INTO Citizen (user_id, full_name, cnic, address, date_of_birth, gender)
          VALUES (@user_id, @full_name, @cnic, @address, @dob, @gender)
        `);

      const roleReq = new sql.Request(tx);
      await roleReq
        .input('user_id', sql.Int, userId)
        .input('role_id', sql.Int, citizenRoleId)
        .query('INSERT INTO User_Role (user_id, role_id) VALUES (@user_id, @role_id)');

      await tx.commit();
      
      res.status(201).json({ message: 'Signup successful, you can now log in' });
    } catch (txErr) {
      await tx.rollback();
      throw txErr;
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Server error during signup' });
  }
});

// ── GET /api/auth/me ─────────────────────────────────────────
router.get('/me', authenticate, async (req, res) => {
  try {
    const pool   = await getPool();
    const result = await pool.request()
      .input('user_id', sql.Int, req.user.user_id)
      .query(`
        SELECT u.user_id, u.username, u.email, u.phone,
               r.role_name, u.created_at
        FROM   [User] u
        INNER JOIN Role r ON r.role_id = u.role_id
        WHERE  u.user_id = @user_id
      `);
    res.json(result.recordset[0]);
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
