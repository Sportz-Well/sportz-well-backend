// routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

router.use(authMiddleware);

// ---------------------------------------------------------
// SECURED ROUTE: ADD NEW PLAYER (Updated to exact requested fields)
// ---------------------------------------------------------
router.post('/add', async (req, res) => {
    // Removed Batting and Bowling style, keeping only the exact fields requested
    const { name, date_of_birth, gender, primary_role, std_div, school_id, mobile_no } = req.body;
    
    const academy_id = req.user.academy_id; 

    try {
        const result = await pool.query(
            `INSERT INTO players (name, date_of_birth, gender, role, academy_id, std_div, school_id, mobile_no) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, date_of_birth, gender, primary_role, academy_id, std_div, school_id, mobile_no]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Database Insert Error:", err);
        res.status(500).json({ success: false, error: "Failed to securely add player. Ensure database columns exist." });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET ALL PLAYERS 
// ---------------------------------------------------------
router.get('/', async (req, res) => {
    let targetAcademyId = req.user.academy_id;

    if (req.user.role === 'admin' && req.query.academy_id) {
        targetAcademyId = req.query.academy_id;
    }

    try {
        const result = await pool.query(
            `SELECT id, name, date_of_birth, gender, role, std_div, school_id, mobile_no, latest_score, coach_signal 
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
        let query = `SELECT * FROM players WHERE id = $1 AND academy_id = $2`;
        let params = [playerId, academy_id];

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