'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db'); 

// ROUTES
const playerRoutes = require('./routes/playerRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const analyticsRoutes = require('./routes/analytics');
const demoRoutes = require('./routes/demoRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// CORS CONFIG
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim())
  : '*';

app.disable('x-powered-by');

app.use(
  cors({
    origin: corsOrigins === '*' ? true : corsOrigins,
    credentials: true
  })
);

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// HEALTH CHECK
app.get('/health', (_req, res) => {
  res.status(200).json({
    success: true,
    message: 'SWPI API is running',
    timestamp: new Date().toISOString()
  });
});

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

    await db.query(`
        CREATE TABLE IF NOT EXISTS users (
            id SERIAL PRIMARY KEY,
            email VARCHAR(255) UNIQUE NOT NULL,
            password VARCHAR(255) NOT NULL,
            role VARCHAR(50),
            school_id INTEGER DEFAULT 1
        );
    `);

    for (let acc of accounts) {
        const existing = await db.query('SELECT * FROM users WHERE email = $1', [acc.email]);
        if (existing.rows.length > 0) {
          await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, acc.email]);
        } else {
          await db.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [acc.email, hashedPassword, acc.role]);
        }
    }
    res.send('<h1 style="color:green; font-family:sans-serif;">✅ SUCCESS: Coach & Admin accounts active!</h1><p style="font-family:sans-serif;">Password is: demo123</p>');
  } catch (err) {
    res.status(500).send('<h1 style="color:red; font-family:sans-serif;">❌ Error</h1><p style="font-family:sans-serif;">' + err.message + '</p>');
  }
});

// --- EMERGENCY PITCH BACKDOOR: DROP, REBUILD, & POPULATE BOTH TABLES ---
app.get('/api/force-populate', async (req, res) => {
  try {
      console.log("--- INITIATING FULL DATABASE REBUILD ---");
      await db.query(`DROP TABLE IF EXISTS assessments CASCADE;`);
      await db.query(`DROP TABLE IF EXISTS players CASCADE;`);
      
      await db.query(`
        CREATE TABLE players (
            id SERIAL PRIMARY KEY,
            school_id INTEGER DEFAULT 1,
            name VARCHAR(255) NOT NULL,
            age INTEGER,
            date_of_birth VARCHAR(50),
            dob VARCHAR(50),
            gender VARCHAR(50),
            role VARCHAR(100),
            latest_score NUMERIC(4,2),
            coach_signal VARCHAR(50),
            std VARCHAR(50),
            div VARCHAR(50),
            school_id_no VARCHAR(100),
            aadhaar_card_no VARCHAR(100),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      await db.query(`
        CREATE TABLE assessments (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
            school_id INTEGER DEFAULT 1,
            quarter VARCHAR(50),
            physical_score NUMERIC(4,2),
            skill_score NUMERIC(4,2),
            mental_score NUMERIC(4,2),
            coach_score NUMERIC(4,2),
            total_score NUMERIC(4,2),
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
      `);

      const dummyPlayers = [
          { name: 'Vihaan Shah', age: 10, dob: '2015-05-10', gender: 'Male', role: 'Batsman', score: 8.5, signal: 'Optimal' },
          { name: 'Rohan Desai', age: 11, dob: '2014-08-20', gender: 'Male', role: 'Pace Bowler', score: 4.2, signal: 'At Risk' },
          { name: 'Manjiri Wadke', age: 11, dob: '2014-11-05', gender: 'Female', role: 'Top Order Batter', score: 7.2, signal: 'Stable' },
          { name: 'Kabir Singh', age: 13, dob: '2013-02-15', gender: 'Male', role: 'All-Rounder', score: 6.8, signal: 'Stable' }
      ];

      for (let p of dummyPlayers) {
          await db.query(
              `INSERT INTO players (school_id, name, age, date_of_birth, dob, gender, role, latest_score, coach_signal, std, div, school_id_no, aadhaar_card_no)
               VALUES (1, $1, $2, $3, $3, $4, $5, $6, $7, '8', 'A', 'SID-000', '0000-0000-0000')`,
              [p.name, p.age, p.dob, p.gender, p.role, p.score, p.signal]
          );
      }
      res.send('<h1 style="color:green; font-family:sans-serif;">✅ SUCCESS: Database Rebuilt!</h1>');
  } catch (err) {
      res.status(500).send('<h1 style="color:red; font-family:sans-serif;">❌ Error</h1><p style="font-family:sans-serif;">' + err.message + '</p>');
  }
});

// ==========================================================
// PHASE 2: ATTENDANCE ROUTE
// ==========================================================
app.post('/api/attendance', async (req, res) => {
    const { school_id, date, attendance_data } = req.body;
    if (!school_id || !date || !attendance_data || attendance_data.length === 0) {
        return res.status(400).json({ error: "Missing required attendance data." });
    }
    try {
        await db.query('BEGIN');
        for (const record of attendance_data) {
            await db.query(
                `INSERT INTO daily_attendance (player_id, school_id, date, status) VALUES ($1, $2, $3, $4)`,
                [record.player_id, school_id, date, record.status]
            );
        }
        await db.query('COMMIT');
        res.status(200).json({ message: "Attendance saved successfully!" });
    } catch (err) {
        await db.query('ROLLBACK');
        console.error("Database Error saving attendance:", err);
        res.status(500).json({ error: "Failed to save attendance." });
    }
});

// ==========================================================
// PHASE 2: WEEKLY MICRO-ASSESSMENT ROUTE
// ==========================================================
app.post('/api/weekly-assessment', async (req, res) => {
    const { school_id, player_id, assessment_date, physical_score, technical_score, mental_score } = req.body;
    if (!school_id || !player_id || !assessment_date) {
        return res.status(400).json({ error: "Missing required assessment data." });
    }
    try {
        await db.query(
            `INSERT INTO weekly_assessments (player_id, school_id, assessment_date, physical_score, technical_score, mental_score)
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [player_id, school_id, assessment_date, physical_score, technical_score, mental_score]
        );
        res.status(200).json({ message: "Weekly assessment saved successfully!" });
    } catch (err) {
        console.error("Database Error saving weekly assessment:", err);
        res.status(500).json({ error: "Failed to save weekly assessment." });
    }
});

// ==========================================================
// PHASE 2: NEW MATCH LOG ROUTE
// ==========================================================
app.post('/api/match-log', async (req, res) => {
    const { school_id, player_id, match_date, tournament_name, runs, balls_faced, fours, sixes } = req.body;
    
    if (!school_id || !player_id || !match_date) {
        return res.status(400).json({ error: "Missing required match data." });
    }

    try {
        await db.query(
            `INSERT INTO match_logs (player_id, school_id, match_date, tournament_name, runs, balls_faced, fours, sixes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [player_id, school_id, match_date, tournament_name, runs || 0, balls_faced || 0, fours || 0, sixes || 0]
        );
        res.status(200).json({ message: "Match logged successfully!" });
    } catch (err) {
        console.error("Database Error saving match log:", err);
        res.status(500).json({ error: "Failed to log match." });
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

// ROOT
app.get('/', (_req, res) => {
  res.send('Sportz-Well Backend Running');
});

// 404 & ERROR HANDLERS
app.use((req, res) => { res.status(404).json({ success: false, message: 'Route not found' }); });
app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ success: false, message: error.message });
});

if (require.main === module) {
  app.listen(PORT, () => { console.log(`SWPI backend running on port ${PORT}`); });
}

module.exports = app;