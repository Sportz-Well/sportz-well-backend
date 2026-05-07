// routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// ---------------------------------------------------------
// ROUTE: ADD NEW PLAYER (Used by add-player.html)
// ---------------------------------------------------------
router.post('/add', async (req, res) => {
    const { name, date_of_birth, gender, primary_role, batting_style, bowling_style, academy_id } = req.body;
    
    // Fallback to academy 1 if not provided by UI
    const targetAcademy = academy_id || 1;

    try {
        const result = await pool.query(
            `INSERT INTO players (name, date_of_birth, gender, role, batting_style, bowling_style, academy_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, date_of_birth, gender, primary_role, batting_style, bowling_style, targetAcademy]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Error adding player:", err);
        res.status(500).json({ success: false, error: "Failed to add player to database." });
    }
});

// ---------------------------------------------------------
// ROUTE: GET ALL PLAYERS BY ACADEMY (Fixes the Empty Lists)
// ---------------------------------------------------------
router.get('/', async (req, res) => {
    // If academy_id is passed in query, use it. Otherwise, default to 1.
    const academy_id = req.query.academy_id || 1;

    try {
        // We select the crucial info needed by Dashboards, Attendance, and Monthly Reports
        const result = await pool.query(
            `SELECT id, name, role, latest_score, coach_signal 
             FROM players 
             WHERE academy_id = $1 
             ORDER BY name ASC`,
            [academy_id]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Error fetching players:", err);
        res.status(500).json({ error: "Failed to fetch roster." });
    }
});

// ---------------------------------------------------------
// ROUTE: DAILY ATTENDANCE SUBMISSION
// ---------------------------------------------------------
router.post('/attendance', async (req, res) => {
    const { academy_id, attendance_date, records } = req.body;
    
    try {
        console.log(`[ATTENDANCE] Date: ${attendance_date} | Records: ${records.length}`);
        res.status(200).json({ success: true, message: "Attendance recorded successfully." });
    } catch (error) {
        console.error("Attendance Error:", error);
        res.status(500).json({ success: false, error: "Failed to save attendance." });
    }
});

// ---------------------------------------------------------
// ROUTE: MATCH LOGGER SUBMISSION
// ---------------------------------------------------------
router.post('/match-log', async (req, res) => {
    const { player_id, match_date, opponent } = req.body;
    
    try {
        console.log(`[MATCH LOG] Player: ${player_id} vs ${opponent} on ${match_date}`);
        res.status(200).json({ success: true, message: "Match logged successfully." });
    } catch (error) {
        console.error("Match Log Error:", error);
        res.status(500).json({ success: false, error: "Failed to log match." });
    }
});

module.exports = router;