'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db'); 

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ==========================================================
// DATABASE AUTO-PATCH: MULTI-ACADEMY & RBAC ARCHITECTURE
// ==========================================================
db.query(`
    CREATE TABLE IF NOT EXISTS academies (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    INSERT INTO academies (id, name, logo_url) VALUES 
    (1, 'Singhania School Cricket Academy', 'https://via.placeholder.com/200x80/ffffff/0A192F?text=SINGHANIA+LOGO'),
    (2, 'Automotive Cricket Academy', 'https://via.placeholder.com/200x80/ffffff/0A192F?text=AUTOMOTIVE+LOGO')
    ON CONFLICT (id) DO NOTHING;

    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        academy_id INTEGER REFERENCES academies(id),
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'junior_coach';
    ALTER TABLE players ADD COLUMN IF NOT EXISTS academy_id INTEGER REFERENCES academies(id) DEFAULT 1;

    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS overs_bowled NUMERIC(4,1) DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS wickets INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS runs_conceded INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS not_out BOOLEAN DEFAULT false;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS catches INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS stumpings INTEGER DEFAULT 0;
    ALTER TABLE match_logs ADD COLUMN IF NOT EXISTS run_outs INTEGER DEFAULT 0;

    CREATE TABLE IF NOT EXISTS video_logs (
        id SERIAL PRIMARY KEY,
        player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
        school_id INTEGER DEFAULT 1,
        upload_date VARCHAR(50),
        video_url TEXT,
        technical_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
`).then(() => console.log("✅ DB Auto-Patched: Multi-Academy RBAC schema fully synchronized."))
  .catch(err => console.error("Auto-patch error:", err));

// ==========================================================
// MIDDLEWARE CONFIGURATION
// ==========================================================
const corsOrigins = process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()) : '*';

app.disable('x-powered-by');
app.use(cors({ origin: corsOrigins === '*' ? true : corsOrigins, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// ==========================================================
// ROUTE REGISTRATION
// ==========================================================
const playerRoutes = require('./routes/playerRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const analyticsRoutes = require('./routes/analytics');
const demoRoutes = require('./routes/demoRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes');
const videoAnalysisRoutes = require('./routes/videoAnalysisRoutes');
const academyRoutes = require('./routes/academyRoutes'); 
const operationsRoutes = require('./routes/operationsRoutes'); // CTO ADDITION: The new operations hub

app.get('/health', (_req, res) => { res.status(200).json({ success: true, message: 'SWPI API is running cleanly' }); });

// API NAMESPACES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/demo', demoRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/video-analysis', videoAnalysisRoutes);
app.use('/api/v1/academies', academyRoutes); 

// Map the old Phase 2 routes directly to '/api' so we don't break the frontend URLs
app.use('/api', operationsRoutes); 

// ERROR HANDLING
app.get('/', (_req, res) => { res.send('Sportz-Well Backend Running (Decoupled Architecture)'); });
app.use((req, res) => { res.status(404).json({ success: false, message: 'Route not found' }); });
app.use((error, _req, res, _next) => {
  const statusCode = error.statusCode || 500;
  res.status(statusCode).json({ success: false, message: error.message });
});

if (require.main === module) {
  app.listen(PORT, () => { console.log(`SWPI backend running on port ${PORT}`); });
}

module.exports = app;