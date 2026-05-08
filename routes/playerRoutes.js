// routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware'); // Import your updated middleware

// Apply the security lock to ALL routes in this file
router.use(authMiddleware);

// ---------------------------------------------------------
// SECURED ROUTE: ADD NEW PLAYER
// ---------------------------------------------------------
router.post('/add', async (req, res) => {
    const { name, date_of_birth, gender, primary_role, batting_style, bowling_style } = req.body;
    
    // We extract the academy_id directly from the verified cryptographic token!
    const academy_id = req.user.academy_id; 

    try {
        const result = await pool.query(
            `INSERT INTO players (name, date_of_birth, gender, role, batting_style, bowling_style, academy_id) 
             VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
            [name, date_of_birth, gender, primary_role, batting_style, bowling_style, academy_id]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ success: false, error: "Failed to securely add player." });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET ALL PLAYERS BY ACADEMY
// ---------------------------------------------------------
router.get('/', async (req, res) => {
    // Enforce the academy_id bound to their JWT token.
    let targetAcademyId = req.user.academy_id;

    // Exception: If a Global Admin is asking for a specific academy, let them.
    if (req.user.role === 'admin' && req.query.academy_id) {
        targetAcademyId = req.query.academy_id;
    }

    try {
        const result = await pool.query(
            `SELECT id, name, role, latest_score, coach_signal 
             FROM players 
             WHERE academy_id = $1 
             ORDER BY name ASC`,
            [targetAcademyId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: "Failed to securely fetch roster." });
    }
});

module.exports = router;