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
// CTO UPGRADE: MULTI-TENANT DATABASE SCRIPT
// =========================================================
app.get('/api/upgrade-tenants', async (req, res) => {
  const db = require('./db');
  try {
    // 1. Add academy_id to players table
    await db.query(`
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS academy_id VARCHAR(100) DEFAULT 'DEMO_ACADEMY';
    `);

    // 2. Add academy_id to assessment_sessions table
    await db.query(`
      ALTER TABLE assessment_sessions 
      ADD COLUMN IF NOT EXISTS academy_id VARCHAR(100) DEFAULT 'DEMO_ACADEMY';
    `);

    // 3. Lock existing demo data to the demo academy
    await db.query(`
      UPDATE players SET academy_id = 'DEMO_ACADEMY' WHERE academy_id IS NULL;
      UPDATE assessment_sessions SET academy_id = 'DEMO_ACADEMY' WHERE academy_id IS NULL;
    `);

    res.send('<h1 style="color:green;">✅ MULTI-TENANT DATABASE UPGRADE SUCCESSFUL</h1><p>Academy ID walls have been built in your PostgreSQL Database.</p>');
  } catch (err) {
    res.status(500).send('<h1 style="color:red;">❌ Error</h1><p>' + err.message + '</p>');
  }
});

// =========================================================
// CTO UPGRADE: SMART TENANT ROUTER
// =========================================================
app.post('/api/v1/auth/login', (req, res) => {
  const { email } = req.body;
  const safeEmail = email ? email.toLowerCase() : 'coach@sportzwell.com';
  
  let role = 'coach';
  let academyId = 'DEMO_ACADEMY';

  // 1. Super Admin Routing
  if (safeEmail.includes('admin')) {
    role = 'admin';
    academyId = 'ALL'; // Master Key
  } 
  // 2. Existing Demo Coach Routing
  else if (safeEmail === 'coach@sportzwell.com' || safeEmail === 'coach@sportz-well.com') {
    role = 'coach';
    academyId = 'DEMO_ACADEMY';
  } 
  // 3. New Client Routing (Extracts domain dynamically)
  else {
    role = 'coach';
    try {
      const domain = safeEmail.split('@')[1];
      const academyName = domain.split('.')[0].toUpperCase();
      academyId = `${academyName}_ACADEMY`; // e.g., "DPS_ACADEMY"
    } catch(e) {
      academyId = 'DEMO_ACADEMY';
    }
  }

  console.log(`🔐 LOGIN SUCCESS: ${safeEmail} | Role: ${role} | Tenant: ${academyId}`);
  
  return res.json({
    success: true,
    token: `swpi-token-${academyId}`, 
    user: {
      id: 999,
      email: safeEmail,
      role: role,
      academy_id: academyId
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
  res.send('Sportz-Well Backend Running (Multi-Tenant Active)');
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