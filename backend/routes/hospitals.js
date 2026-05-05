// ============================================================
// routes/hospitals.js
// ============================================================
const express = require('express');
const { getPool, sql } = require('../db');
const { authenticate, authorize } = require('../middleware/auth');
const hospitalsRouter = express.Router();
hospitalsRouter.use(authenticate);

// GET /api/hospitals — via vw_Hospital_Capacity
// NOTE: vw_Hospital_Capacity already exposes hospital_id.
// Do NOT join back to Hospital on hospital_name — that fan-outs and duplicates rows.
hospitalsRouter.get('/', async (req, res) => {
    try {
        const pool = await getPool();
        const result = await pool.request().query(`
            SELECT
                hospital_id,
                hospital_name,
                location,
                contact_number,
                specialization,
                total_beds,
                available_beds,
                occupied_beds,
                occupancy_pct,
                critical_patients,
                admitted_patients,
                capacity_status
            FROM vw_Hospital_Capacity
            ORDER BY occupancy_pct DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

hospitalsRouter.get('/patients', authorize('System_Admin', 'Disaster_Coordinator'), async (req, res) => {
    try {
        const { status, hospital_id } = req.query;
        const pool = await getPool();
        const request = pool.request();
        let where = 'WHERE 1=1';
        if (status) { request.input('status', sql.VarChar, status); where += ' AND P.status = @status'; }
        if (hospital_id) { request.input('hospital_id', sql.Int, hospital_id); where += ' AND P.hospital_id = @hospital_id'; }

        const result = await request.query(`
            SELECT
                P.patient_id,
                P.report_id,
                P.hospital_id,
                H.hospital_name,
                P.full_name,
                P.age,
                P.gender,
                P.admission_time,
                P.discharge_time,
                P.status,
                P.medical_notes,
                ER.location AS report_location,
                DE.event_name
            FROM Patient P
            INNER JOIN Hospital H ON H.hospital_id = P.hospital_id
            INNER JOIN Emergency_Report ER ON ER.report_id = P.report_id
            INNER JOIN Disaster_Event DE ON DE.event_id = ER.disaster_event_id
            ${where}
            ORDER BY P.admission_time DESC
        `);
        res.json(result.recordset);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /api/hospitals/:id/admit — admit a patient
hospitalsRouter.post('/:id/admit',
    authorize('System_Admin', 'Disaster_Coordinator'),
    async (req, res) => {
        const { report_id, full_name, age, gender, medical_notes } = req.body;
        if (!report_id || !full_name || !age || !gender) {
            return res.status(400).json({ error: 'report_id, full_name, age, and gender are required' });
        }

        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            // Check bed availability
            const beds = await new sql.Request(tx)
                .input('hid', sql.Int, req.params.id)
                .query(`SELECT available_beds FROM Hospital WITH (UPDLOCK, ROWLOCK) WHERE hospital_id = @hid`);
            if (!beds.recordset.length) {
                await tx.rollback();
                return res.status(404).json({ error: 'Hospital not found' });
            }
            if (beds.recordset[0].available_beds === 0) {
                await tx.rollback();
                return res.status(409).json({ error: 'No available beds' });
            }

            // Admit patient + decrement beds
            await new sql.Request(tx)
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

            await tx.commit();
            res.status(201).json({ message: 'Patient admitted' });
        } catch (err) {
            try { await tx.rollback(); } catch { /* transaction may already be closed */ }
            res.status(500).json({ error: err.message });
        }
    }
);

// POST /api/hospitals/auto-admit — auto-assign patient based on capacity
hospitalsRouter.post('/auto-admit',
    authorize('System_Admin', 'Disaster_Coordinator'),
    async (req, res) => {
        const { report_id, full_name, age, gender, medical_notes } = req.body;
        if (!report_id || !full_name || !age || !gender) {
            return res.status(400).json({ error: 'report_id, full_name, age, and gender are required' });
        }

        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            // Find the hospital with the most available beds
            const bestHospital = await new sql.Request(tx).query(`
                SELECT TOP 1 hospital_id, hospital_name, available_beds
                FROM Hospital WITH (UPDLOCK, ROWLOCK)
                WHERE available_beds > 0
                ORDER BY available_beds DESC, ((total_beds - available_beds) * 100.0 / total_beds) ASC
            `);

            if (!bestHospital.recordset.length) {
                await tx.rollback();
                return res.status(409).json({ error: 'No available beds in any hospital' });
            }

            const hospital = bestHospital.recordset[0];

            // Admit patient + decrement beds
            await new sql.Request(tx)
                .input('hospital_id', sql.Int, hospital.hospital_id)
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

            await tx.commit();
            res.status(201).json({
                message: `Patient automatically admitted to ${hospital.hospital_name}`,
                hospital_name: hospital.hospital_name
            });
        } catch (err) {
            try { await tx.rollback(); } catch { /* closed */ }
            res.status(500).json({ error: err.message });
        }
    }
);

hospitalsRouter.patch('/patients/:id',
    authorize('System_Admin', 'Disaster_Coordinator'),
    async (req, res) => {
        const { full_name, age, gender, status, medical_notes } = req.body;

        try {
            const pool = await getPool();
            const result = await pool.request()
                .input('id', sql.Int, req.params.id)
                .input('full_name', sql.VarChar, full_name || null)
                .input('age', sql.Int, age || null)
                .input('gender', sql.VarChar, gender || null)
                .input('status', sql.VarChar, status || null)
                .input('medical_notes', sql.Text, medical_notes || null)
                .query(`
                    UPDATE Patient
                    SET full_name = COALESCE(@full_name, full_name),
                        age = COALESCE(@age, age),
                        gender = COALESCE(@gender, gender),
                        status = COALESCE(@status, status),
                        medical_notes = COALESCE(@medical_notes, medical_notes)
                    WHERE patient_id = @id;

                    SELECT @@ROWCOUNT AS updated;
                `);

            if (!result.recordset[0].updated) return res.status(404).json({ error: 'Patient not found' });
            res.json({ message: 'Patient updated' });
        } catch (err) { res.status(500).json({ error: err.message }); }
    }
);

hospitalsRouter.patch('/patients/:id/discharge',
    authorize('System_Admin', 'Disaster_Coordinator'),
    async (req, res) => {
        const pool = await getPool();
        const tx = new sql.Transaction(pool);

        try {
            await tx.begin();

            const patient = await new sql.Request(tx)
                .input('id', sql.Int, req.params.id)
                .query(`
                    SELECT patient_id, hospital_id, status
                    FROM Patient WITH (UPDLOCK, ROWLOCK)
                    WHERE patient_id = @id
                `);

            if (!patient.recordset.length) {
                await tx.rollback();
                return res.status(404).json({ error: 'Patient not found' });
            }

            if (patient.recordset[0].status === 'Discharged') {
                await tx.rollback();
                return res.status(409).json({ error: 'Patient is already discharged' });
            }

            await new sql.Request(tx)
                .input('id', sql.Int, req.params.id)
                .input('hospital_id', sql.Int, patient.recordset[0].hospital_id)
                .query(`
                    UPDATE Patient
                    SET status = 'Discharged',
                        discharge_time = GETDATE()
                    WHERE patient_id = @id;

                    UPDATE Hospital
                    SET available_beds = available_beds + 1
                    WHERE hospital_id = @hospital_id
                    AND available_beds < total_beds;
                `);

            await tx.commit();
            res.json({ message: 'Patient discharged' });
        } catch (err) {
            try { await tx.rollback(); } catch { /* closed */ }
            res.status(500).json({ error: err.message });
        }
    }
);

module.exports.hospitalsRouter = hospitalsRouter;
