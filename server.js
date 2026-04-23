'use strict';

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const db = require('./db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken'); // CTO ADDITION: Required for route security

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 5000;

// ==========================================================
// DATABASE AUTO-PATCH: MULTI-ACADEMY & RBAC ARCHITECTURE
// ==========================================================
db.query(`
    -- 1. Create Academies (The Walls)
    CREATE TABLE IF NOT EXISTS academies (
        id INTEGER PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        logo_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 2. Insert Default Academies (To prevent data orphans)
    INSERT INTO academies (id, name, logo_url) VALUES 
    (1, 'Singhania School Cricket Academy', 'https://via.placeholder.com/200x80/ffffff/0A192F?text=SINGHANIA+LOGO'),
    (2, 'Automotive Cricket Academy', 'https://via.placeholder.com/200x80/ffffff/0A192F?text=AUTOMOTIVE+LOGO')
    ON CONFLICT (id) DO NOTHING;

    -- 3. Create Users (The Keys / Role-Based Access Control)
    CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        academy_id INTEGER REFERENCES academies(id),
        name VARCHAR(255),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(50) NOT NULL, -- 'admin', 'head_coach', 'junior_coach'
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    -- 3.5 BRUTE-FORCE SCHEMA PATCHES FOR LEGACY USERS TABLE
    ALTER TABLE users ADD COLUMN IF NOT EXISTS academy_id INTEGER DEFAULT 1;
    ALTER TABLE users ADD COLUMN IF NOT EXISTS name VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);
    ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(50) DEFAULT 'junior_coach';

    -- 4. Update Players (Assigning to Academies)
    ALTER TABLE players ADD COLUMN IF NOT EXISTS academy_id INTEGER REFERENCES academies(id) DEFAULT 1;

    -- Legacy auto-patches
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
const videoAnalysisRoutes = require('./routes/videoAnalysisRoutes');
const academyRoutes = require('./routes/academyRoutes'); 

app.get('/health', (_req, res) => { res.status(200).json({ success: true, message: 'SWPI API is running' }); });

// ==========================================================
// SECURITY MIDDLEWARE: TENANT ISOLATION FOR PHASE 2 ROUTES
// ==========================================================
const verifyCoach = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_change_this_in_production');
        req.user = decoded; 
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }
};

// ==========================================================
// PHASE 2 ROUTES (Fully Secured)
// ==========================================================

app.post('/api/attendance', verifyCoach, async (req, res) => {
    const { date, attendance_data } = req.body;
    const secureAcademyId = req.user.academy_id; // CTO FIX: Extracted from token

    if (!date || !attendance_data || attendance_data.length === 0) return res.status(400).json({ error: "Missing data." });
    try {
        await db.query('BEGIN');
        for (const record of attendance_data) {
            await db.query(`INSERT INTO daily_attendance (player_id, school_id, date, status) VALUES ($1, $2, $3, $4)`, 
            [record.player_id, secureAcademyId, date, record.status]);
        }
        await db.query('COMMIT');
        res.status(200).json({ message: "Attendance saved!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "Failed to save attendance." });
    }
});

app.post('/api/weekly-assessment', verifyCoach, async (req, res) => {
    const { player_id, assessment_date, physical_score, technical_score, mental_score } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !assessment_date) return res.status(400).json({ error: "Missing data." });
    try {
        await db.query(
            `INSERT INTO weekly_assessments (player_id, school_id, assessment_date, physical_score, technical_score, mental_score) VALUES ($1, $2, $3, $4, $5, $6)`,
            [player_id, secureAcademyId, assessment_date, physical_score, technical_score, mental_score]
        );
        res.status(200).json({ message: "Assessment saved!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save assessment." });
    }
});

app.post('/api/match-log', verifyCoach, async (req, res) => {
    const { player_id, match_date, tournament_name, runs, balls_faced, fours, sixes, not_out, overs_bowled, wickets, runs_conceded, catches, stumpings, run_outs } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !match_date) return res.status(400).json({ error: "Missing match data." });
    try {
        await db.query(
            `INSERT INTO match_logs (player_id, school_id, match_date, tournament_name, runs, balls_faced, fours, sixes, not_out, overs_bowled, wickets, runs_conceded, catches, stumpings, run_outs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [player_id, secureAcademyId, match_date, tournament_name, runs || 0, balls_faced || 0, fours || 0, sixes || 0, not_out || false, overs_bowled || 0, wickets || 0, runs_conceded || 0, catches || 0, stumpings || 0, run_outs || 0]
        );
        res.status(200).json({ message: "Match logged!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to log match." });
    }
});

app.post('/api/coach-remarks', verifyCoach, async (req, res) => {
    const { player_id, remark_date, notes } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !remark_date || !notes) return res.status(400).json({ error: "Missing remark data." });
    try {
        await db.query(`INSERT INTO coach_remarks (player_id, school_id, remark_date, notes) VALUES ($1, $2, $3, $4)`, 
        [player_id, secureAcademyId, remark_date, notes]);
        res.status(200).json({ message: "Remark saved!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save remark." });
    }
});

app.post('/api/video-log', verifyCoach, async (req, res) => {
    const { player_id, upload_date, video_url, technical_notes } = req.body;
    const secureAcademyId = req.user.academy_id;
    
    if (!player_id || !upload_date || !video_url) {
        return res.status(400).json({ error: "Missing required video data." });
    }

    try {
        await db.query(
            `INSERT INTO video_logs (player_id, school_id, upload_date, video_url, technical_notes)
             VALUES ($1, $2, $3, $4, $5)`,
            [player_id, secureAcademyId, upload_date, video_url, technical_notes]
        );
        res.status(200).json({ message: "Video analysis saved successfully!" });
    } catch (err) {
        console.error("Database Error saving video log:", err);
        res.status(500).json({ error: "Failed to log video." });
    }
});

// Helper for Exponential Backoff
const delay = ms => new Promise(res => setTimeout(res, ms));

// ==========================================================
// SWPI ADVANCED ANALYTICS ENGINE (With Backoff & Fallback)
// ==========================================================
app.post('/api/generate-ai-report', verifyCoach, async (req, res) => {
    const { player_id } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id) return res.status(400).json({ error: "Missing player_id" });

    try {
        // CTO FIX: Prevent IDOR. Ensure this player actually belongs to this coach's academy before hitting the AI
        const playerRes = await db.query('SELECT name FROM players WHERE id = $1 AND academy_id = $2', [player_id, secureAcademyId]);
        if (playerRes.rows.length === 0) return res.status(403).json({ error: "Access denied or Player not found." });
        const player = playerRes.rows[0];

        const matchesRes = await db.query('SELECT * FROM match_logs WHERE player_id = $1 ORDER BY match_date DESC LIMIT 10', [player_id]);
        const matches = matchesRes.rows;

        const remarksRes = await db.query('SELECT notes FROM coach_remarks WHERE player_id = $1 ORDER BY remark_date DESC LIMIT 5', [player_id]);
        const coachNotes = remarksRes.rows.map(r => r.notes).join(' | ');

        let totalRuns = 0; let dismissals = 0; let totalRunsConceded = 0; let totalOvers = 0; let totalWickets = 0;
        
        matches.forEach(m => {
            totalRuns += Number(m.runs || 0);
            if (!m.not_out) dismissals += 1;
            totalRunsConceded += Number(m.runs_conceded || 0);
            totalOvers += Number(m.overs_bowled || 0);
            totalWickets += Number(m.wickets || 0);
        });

        const batAvg = dismissals > 0 ? (totalRuns / dismissals).toFixed(2) : (totalRuns > 0 ? `${totalRuns} (Undefeated)` : "0.00");
        const ecoRate = totalOvers > 0 ? (totalRunsConceded / totalOvers).toFixed(2) : "0.00";

        const prompt = `
        You are an elite cricket high-performance coach writing a monthly report for the parents of ${player.name}.
        
        Hard Data (Last ${matches.length} matches):
        - Batting Average: ${batAvg}
        - Bowling Economy Rate: ${ecoRate}
        - Total Wickets: ${totalWickets}
        
        Coach's Subjective Remarks: "${coachNotes || 'No recent remarks.'}"
        
        Write a professional, encouraging 3-paragraph report. 
        Paragraph 1: Summarize their statistical match form. (Acknowledge if there is no data yet).
        Paragraph 2: Perform a sentiment analysis on the coach's remarks regarding their mental focus and technique.
        Paragraph 3: Create a specific 3-step "Action Plan" of drills for them to work on next month.
        Do not use markdown like asterisks or bold text, just plain text with line breaks.
        `;

        // Retry Logic Configuration
        let attempt = 0;
        const maxAttempts = 3;
        let aiReportText = "";
        let aiSuccess = false;
        let lastError = null;

        while (attempt < maxAttempts && !aiSuccess) {
            try {
                const currentModelName = (attempt === maxAttempts - 1) ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
                
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: currentModelName });

                const result = await model.generateContent(prompt);
                
                if (!result || !result.response) {
                    throw new Error("The AI returned an empty response.");
                }
                
                aiReportText = result.response.text();
                aiSuccess = true;
            } catch (err) {
                lastError = err;
                attempt++;
                if (attempt < maxAttempts) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    console.warn(`[SWPI Warning] AI Model overloaded. Attempt ${attempt} failed. Retrying in ${waitTime}ms...`);
                    await delay(waitTime);
                } else {
                    console.error("[SWPI Critical] All AI retries and fallbacks exhausted.");
                }
            }
        }

        if (!aiSuccess) {
            throw lastError;
        }

        res.status(200).json({
            success: true,
            player_name: player.name,
            calculated_stats: { batAvg, ecoRate, totalWickets, matches_played: matches.length },
            ai_report: aiReportText
        });

    } catch (err) {
        console.error("AI Gen Error:", err);
        res.status(500).json({ error: "AI Error: " + err.message });
    }
});

// API ROUTES
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/demo', demoRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/video-analysis', videoAnalysisRoutes);
app.use('/api/v1/academies', academyRoutes); 

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