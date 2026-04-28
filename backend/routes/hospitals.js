// ============================================================
// routes/hospitals.js
// ============================================================
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const hospitalsRouter = express.Router();
hospitalsRouter.use(authenticate);

// GET /api/hospitals — via vw_Hospital_Capacity
hospitalsRouter.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
      SELECT
        H.hospital_id,
        V.hospital_name,
        V.location,
        V.contact_number,
        V.specialization,
        V.total_beds,
        V.available_beds,
        V.occupied_beds,
        V.occupancy_pct,
        V.critical_patients,
        V.admitted_patients,
        V.capacity_status
      FROM vw_Hospital_Capacity V
      INNER JOIN Hospital H ON H.hospital_name = V.hospital_name
      ORDER BY V.occupancy_pct DESC
    `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hospitals/:id/admit — admit a patient
hospitalsRouter.post('/:id/admit',
    authorize('System_Admin', 'Disaster_Coordinator'),
    async (req, res) => {
        const { report_id, full_name, age, gender, medical_notes } = req.body;
        try {
            const pool = await getPool();

            // Check bed availability
            const beds = await pool.request()
                .input('hid', sql.Int, req.params.id)
                .query(`SELECT available_beds FROM Hospital WHERE hospital_id = @hid`);
            if (!beds.recordset.length) return res.status(404).json({ error: 'Hospital not found' });
            if (beds.recordset[0].available_beds === 0)
                return res.status(409).json({ error: 'No available beds' });

            // Admit patient + decrement beds
            await pool.request()
                .input('hospital_id', sql.Int, req.params.id)
                .input('report_id', sql.Int, report_id)
                .input('full_name', sql.VarChar, full_name)
                .input('age', sql.Int, age)
                .input('gender', sql.VarChar, gender)
                .input('medical_notes', sql.Text, medical_notes || null)
                .query(`
          INSERT INTO Patient
            (report_id, hospital_id, full_name, age, gender,
             admission_time, status, medical_notes)
          VALUES (@report_id, @hospital_id, @full_name, @age, @gender,
                  GETDATE(), 'Admitted', @medical_notes);

          UPDATE Hospital
          SET available_beds = available_beds - 1
          WHERE hospital_id = @hospital_id;
        `);

            res.status(201).json({ message: 'Patient admitted' });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

module.exports.hospitalsRouter = hospitalsRouter;
