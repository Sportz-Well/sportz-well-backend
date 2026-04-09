'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');

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

// --- TEMPORARY BACKDOOR TO CREATE COACH ACCOUNT ---
app.get('/api/create-coach-demo', async (req, res) => {
  const bcrypt = require('bcrypt');
  const db = require('./db');
  try {
    const email = 'coach@sportz-well.com';
    const password = 'demo123';
    const hashedPassword = await bcrypt.hash(password, 10);

    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      await db.query('UPDATE users SET password = $1 WHERE email = $2', [hashedPassword, email]);
      res.send('<h1 style="color:green; font-family:sans-serif;">✅ SUCCESS: Coach password updated to demo123!</h1><p style="font-family:sans-serif;">You can now log in.</p>');
    } else {
      await db.query('INSERT INTO users (email, password, role) VALUES ($1, $2, $3)', [email, hashedPassword, 'coach']);
      res.send('<h1 style="color:green; font-family:sans-serif;">✅ SUCCESS: Coach account created with demo123!</h1><p style="font-family:sans-serif;">You can now log in.</p>');
    }
  } catch (err) {
    res.status(500).send('<h1 style="color:red; font-family:sans-serif;">❌ Error</h1><p style="font-family:sans-serif;">' + err.message + '</p>');
  }
});
// --------------------------------------------------

// --- EMERGENCY PITCH BACKDOOR: FORCE POPULATE 10 PLAYERS ---
app.get('/api/force-populate', async (req, res) => {
  const db = require('./db');
  try {
      console.log("--- INITIATING CLOUD BACKDOOR RESET ---");
      await db.query('DELETE FROM players WHERE school_id = 1');
      
      const dummyPlayers = [
          { name: 'Vihaan Shah', age: 10, dob: '2016-04-12', gender: 'Male', role: 'Batsman', score: 8.5, signal: 'Optimal' },
          { name: 'Rohan Desai', age: 12, dob: '2014-08-22', gender: 'Male', role: 'Pace Bowler', score: 4.2, signal: 'At Risk' },
          { name: 'Kabir Singh', age: 13, dob: '2013-11-10', gender: 'Male', role: 'All-Rounder', score: 6.8, signal: 'Stable' },
          { name: 'Aryan Patel', age: 10, dob: '2016-07-04', gender: 'Male', role: 'Spin Bowler', score: 3.8, signal: 'At Risk' },
          { name: 'Dhruv Joshi', age: 12, dob: '2014-02-28', gender: 'Male', role: 'Wicket Keeper', score: 7.5, signal: 'Optimal' },
          { name: 'Manjiri Wadke', age: 13, dob: '2013-09-12', gender: 'Female', role: 'Top Order Batter', score: 7.2, signal: 'Stable' },
          { name: 'Sara Gupte', age: 12, dob: '2014-03-18', gender: 'Female', role: 'Spinner', score: 4.5, signal: 'At Risk' },
          { name: 'Priya Iyer', age: 10, dob: '2016-12-05', gender: 'Female', role: 'All-Rounder', score: 8.1, signal: 'Optimal' },
          { name: 'Neha Reddy', age: 13, dob: '2013-04-25', gender: 'Female', role: 'Pace Bowler', score: 6.5, signal: 'Stable' },
          { name: 'Ananya Sharma', age: 12, dob: '2014-01-30', gender: 'Female', role: 'Wicket Keeper', score: 7.8, signal: 'Optimal' }
      ];

      for (let p of dummyPlayers) {
          await db.query(
              `INSERT INTO players (school_id, name, age, date_of_birth, gender, role, latest_score, coach_signal, std, div, school_id_no, aadhaar_card_no)
               VALUES (1, $1, $2, $3, $4, $5, $6, $7, '8', 'A', 'SID-000', '0000-0000-0000')`,
              [p.name, p.age, p.dob, p.gender, p.role, p.score, p.signal]
          );
      }
      res.send('<h1 style="color:green; font-family:sans-serif;">✅ SUCCESS: 10 Players Injected!</h1><p style="font-family:sans-serif;">Go refresh your Vercel Dashboard.</p>');
  } catch (err) {
      console.error('Backdoor Reset Error:', err);
      res.status(500).send('<h1 style="color:red; font-family:sans-serif;">❌ Error</h1><p style="font-family:sans-serif;">' + err.message + '</p>');
  }
});
// -----------------------------------------------------------

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

// 404 HANDLER
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// ERROR HANDLER
app.use((error, _req, res, _next) => {
  console.error('[server] Unhandled error:', error);
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: statusCode === 500 ? 'Internal server error' : error.message
  });
});

// START SERVER
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SWPI backend running on port ${PORT}`);
  });
}

module.exports = app;