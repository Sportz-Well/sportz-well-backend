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
      await db.query('INSERT INTO users (email, password) VALUES ($1, $2)', [email, hashedPassword]);
      res.send('<h1 style="color:green; font-family:sans-serif;">✅ SUCCESS: Coach account created with demo123!</h1><p style="font-family:sans-serif;">You can now log in.</p>');
    }
  } catch (err) {
    res.status(500).send('<h1 style="color:red; font-family:sans-serif;">❌ Error</h1><p style="font-family:sans-serif;">' + err.message + '</p>');
  }
});
// --------------------------------------------------

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