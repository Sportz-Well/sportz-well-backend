'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db'); 

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ==========================================================
// DATABASE AUTO-PATCH 2 (Adds Fielding & Not Out tracking)
// ==========================================================
db.query(`
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS overs_bowled NUMERIC(4,1) DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS wickets INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS runs_conceded INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS not_out BOOLEAN DEFAULT false;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS catches INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS stumpings INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS run_outs INTEGER DEFAULT 0;
`).then(() => console.log("✅ DB Auto-Patched: Fielding & Match stats ready."))
  .catch(err => console.error("Auto-patch error:", err));
// ==========================================================

// CORS CONFIG
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : '*';

app.disable('x-powered-by');

app.use(
  cors({
    origin: corsOrigins === '*' ? true : corsOrigins,
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ROUTES
const playerRoutes = require('./routes/playerRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const analyticsRoutes = require('./routes/analytics');
const demoRoutes = require('./routes/demoRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

app.get('/health', (_req, res) => { res.status(200).json({ success: true, message: 'SWPI API is running' }); });

// --- TEMPORARY BACKDOOR TO CREATE COACH & ADMIN ACCOUNTS ---
app.get('/api/create-coach-demo', async (req, res) => {
  const bcrypt = require('bcrypt');
  try {
    const password = 'demo123';
    const hashedPassword = await bcrypt.hash(password, 10);
    const accounts = [
        { email: 'coach@sportzwell.com', role: 'coach' },
        { email: 'admin@sportzwell.com', role: 'admin' }
    ];
    await db.query(`CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, email VARCHAR(255) UNIQUE NOT NULL, password VARCHAR(255) NOT NULL, role VARCHAR(50), school_id INTEGER DEFAULT 1);`);
    for (let acc of accounts) {
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [acc.email]);
        if (existing.rows.length > 0) {
          await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, acc.email]);
        } else {
          await db.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [acc.email, hashedPassword, acc.role]);
        }
    }
    res.send('<h1 style="color:green;">✅ SUCCESS: Accounts active!</h1><p>Password: demo123</p>');
  } catch (err) {
    res.status(500).send('<h1 style="color:red;">❌ Error</h1><p>' + err.message + '</p>');
  }
});

app.get('/api/force-populate', async (req, res) => {
    res.send('<h1 style="color:orange;">Backdoor active but skipped for safety during Phase 2.</h1>');
});

// PHASE 2: ATTENDANCE ROUTE
app.post('/api/attendance', async (req, res) => {
    const { school_id, date, attendance_data } = req.body;
    if (!school_id || !date || !attendance_data || attendance_data.length === 0) return res.status(400).json({ error: "Missing data." });
    try {
        await db.query('BEGIN');
        for (const record of attendance_data) {
            await db.query(`INSERT INTO daily_attendance (player_id, school_id, date, status) VALUES ($1, $2, $3, $4)`, [record.player_id, school_id, date, record.status]);
        }
        await db.query('COMMIT');
        res.status(200).json({ message: "Attendance saved!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "Failed to save attendance." });
    }
});

// PHASE 2: WEEKLY MICRO-ASSESSMENT ROUTE
app.post('/api/weekly-assessment', async (req, res) => {
    const { school_id, player_id, assessment_date, physical_score, technical_score, mental_score } = req.body;
    if (!school_id || !player_id || !assessment_date) return res.status(400).json({ error: "Missing data." });
    try {
        await db.query(
            `INSERT INTO weekly_assessments (player_id, school_id, assessment_date, physical_score, technical_score, mental_score) VALUES ($1, $2, $3, $4, $5, $6)`,
            [player_id, school_id, assessment_date, physical_score, technical_score, mental_score]
        );
        res.status(200).json({ message: "Assessment saved!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save assessment." });
    }
});

// PHASE 2: MATCH LOG ROUTE
app.post('/api/match-log', async (req, res) => {
    const { 
        school_id, player_id, match_date, tournament_name, 
        runs, balls_faced, fours, sixes, not_out, 
        overs_bowled, wickets, runs_conceded,
        catches, stumpings, run_outs 
    } = req.body;
    
    if (!school_id || !player_id || !match_date) return res.status(400).json({ error: "Missing required match data." });

    try {
        await db.query(
            `INSERT INTO match_logs 
            (player_id, school_id, match_date, tournament_name, runs, balls_faced, fours, sixes, not_out, overs_bowled, wickets, runs_conceded, catches, stumpings, run_outs)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [
                player_id, school_id, match_date, tournament_name, 
                runs || 0, balls_faced || 0, fours || 0, sixes || 0, not_out || false, 
                overs_bowled || 0, wickets || 0, runs_conceded || 0,
                catches || 0, stumpings || 0, run_outs || 0
            ]
        );
        res.status(200).json({ message: "Match logged successfully!" });
    } catch (err) {
        console.error("Database Error saving match log:", err);
        res.status(500).json({ error: "Failed to log match." });
    }
});

// ==========================================================
// PHASE 2: COACH REMARKS ROUTE
// ==========================================================
app.post('/api/coach-remarks', async (req, res) => {
    const { school_id, player_id, remark_date, notes } = req.body;
    
    if (!school_id || !player_id || !remark_date || !notes) {
        return res.status(400).json({ error: "Missing required remark data." });
    }

    try {
        await db.query(
            `INSERT INTO coach_remarks (player_id, school_id, remark_date, notes)
             VALUES ($1, $2, $3, $4)`,
            [player_id, school_id, remark_date, notes]
        );
        res.status(200).json({ message: "Remark saved successfully!" });
    } catch (err) {
        console.error("Database Error saving remark:", err);
        res.status(500).json({ error: "Failed to save remark." });
    }
});
// ==========================================================

// API ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/demo', demoRoutes);
app.use('/api/v1/admin', adminRoutes);

app.get('/', (_req, res) => { res.send('Sportz-Well Backend Running'); });

app.use((req, res) => { res.status(404).json({ success: false, message: 'Route not found' }); });
app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ success: false, message: error.message });
});

if (require.main === module) {
  app.listen(PORT, () => { console.log(`SWPI backend running on port ${PORT}`); });
}

module.exports = app;