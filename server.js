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

app.get('/api/fix-db', async (req, res) => {
  const db = require('./db');
  try {
    await db.query(`
      ALTER TABLE assessment_sessions 
      ALTER COLUMN physical_score TYPE DECIMAL(5,1) USING physical_score::numeric,
      ALTER COLUMN skill_score TYPE DECIMAL(5,1) USING skill_score::numeric,
      ALTER COLUMN mental_score TYPE DECIMAL(5,1) USING mental_score::numeric,
      ALTER COLUMN coach_score TYPE DECIMAL(5,1) USING coach_score::numeric,
      ALTER COLUMN overall_score TYPE DECIMAL(5,1) USING overall_score::numeric;
      ALTER TABLE players
      ALTER COLUMN latest_score TYPE DECIMAL(5,1) USING latest_score::numeric;
    `);
    res.send('<h1 style="color:green;">✅ SUCCESS</h1>');
  } catch (err) {
    res.status(500).send('Error: ' + err.message);
  }
});

// =========================================================
// CTO FIX: THE HOLIDAY BYPASS IS BACK!
// Intercepts the login and forces the door open.
// =========================================================
app.post('/api/v1/auth/login', (req, res) => {
  const { email } = req.body;
  
  // Smart detection: If you type admin, you get admin powers. Otherwise, coach.
  const role = (email && email.includes('admin')) ? 'admin' : 'coach';
  const safeEmail = email || 'coach@sportz-well.com';

  console.log(`🚨 HOLIDAY BYPASS TRIGGERED FOR: ${safeEmail} (Role: ${role})`);
  
  return res.json({
    success: true,
    token: 'swpi-demo-token-12345',
    user: {
      id: 999,
      email: safeEmail,
      role: role
    }
  });
});
// =========================================================

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
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ERROR HANDLER
app.use((error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({ success: false, message: error.message });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SWPI backend running on port ${PORT}`);
  });
}

module.exports = app;