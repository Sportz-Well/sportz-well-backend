'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');
const jwt = require('jsonwebtoken');

// ==========================================================
// SECURITY MIDDLEWARE: STRICT TENANT ISOLATION
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

// Apply security to all routes in this file
router.use(verifyCoach);

// ==========================================================
// COACH OPERATIONS (Phase 2 Routes)
// ==========================================================

router.post('/attendance', async (req, res) => {
    const { date, attendance_data } = req.body;
    const secureAcademyId = req.user.academy_id; 

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

router.post('/weekly-assessment', async (req, res) => {
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

router.post('/match-log', async (req, res) => {
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

router.post('/coach-remarks', async (req, res) => {
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

router.post('/video-log', async (req, res) => {
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
router.post('/generate-ai-report', async (req, res) => {
    const { player_id } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id) return res.status(400).json({ error: "Missing player_id" });

    try {
        // Prevent IDOR: Ensure this player belongs to this coach's academy
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

module.exports = router;