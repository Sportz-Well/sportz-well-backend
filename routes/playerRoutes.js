// routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// Apply security lock
router.use(authMiddleware);

// ---------------------------------------------------------
// SECURED ROUTE: ADD NEW PLAYER
// ---------------------------------------------------------
router.post('/add', async (req, res) => {
    const { name, date_of_birth, gender, primary_role, batting_style, bowling_style } = req.body;
    
    // Extract academy_id securely from the JWT token
    const academy_id = req.user.academy_id; 

    try {
        const result = await pool.query(
            `INSERT INTO players (name, date_of_birth, gender, role, batting_style, bowling_style, academy_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, date_of_birth, gender, primary_role, batting_style, bowling_style, academy_id]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Database Insert Error:", err);
        res.status(500).json({ success: false, error: "Failed to securely add player." });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET ALL PLAYERS (Fixed to include DOB & Gender)
// ---------------------------------------------------------
router.get('/', async (req, res) => {
    let targetAcademyId = req.user.academy_id;

    if (req.user.role === 'admin' && req.query.academy_id) {
        targetAcademyId = req.query.academy_id;
    }

    try {
        // ADDED: date_of_birth and gender to the SELECT statement
        const result = await pool.query(
            `SELECT id, name, date_of_birth, gender, role, latest_score, coach_signal 
             FROM players 
             WHERE academy_id = $1 
             ORDER BY name ASC`,
            [targetAcademyId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Database Fetch Error:", err);
        res.status(500).json({ error: "Failed to securely fetch roster." });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET SINGLE PLAYER PROFILE
// ---------------------------------------------------------
router.get('/:id', async (req, res) => {
    const playerId = req.params.id;
    const academy_id = req.user.academy_id;

    try {
        // Ensure the coach can only fetch players from their own academy
        let query = `SELECT * FROM players WHERE id = $1 AND academy_id = $2`;
        let params = [playerId, academy_id];

        // Global admin can fetch any player
        if (req.user.role === 'admin') {
            query = `SELECT * FROM players WHERE id = $1`;
            params = [playerId];
        }

        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Player not found or access denied." });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Database Fetch Single Player Error:", err);
        res.status(500).json({ error: "Failed to fetch player profile." });
    }
});

module.exports = router;