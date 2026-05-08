const express = require('express');
const router = express.Router();
const pool = require('../db'); 

// --- 1. FETCH ALL PLAYERS (Used by Directory & Squad Evaluation) ---
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM players ORDER BY id DESC');
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error("Database Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch players from database." });
    }
});

// --- 2. ADD NEW PLAYER (With SAFE Strict Null Checking) ---
router.post('/', async (req, res) => {
    try {
        const { first_name, last_name, primary_role } = req.body;

        // SAFE NULL CHECK: Prevents server crashes if fields are entirely missing
        if (!first_name || typeof first_name !== 'string' || first_name.trim() === '') {
            return res.status(400).json({ error: "First name is strictly required." });
        }

        // Safely parse optional fields
        const safeLastName = (last_name && typeof last_name === 'string') ? last_name.trim() : '';
        const safeRole = (primary_role && typeof primary_role === 'string') ? primary_role.trim() : 'Cricket Player';

        const insertQuery = `
            INSERT INTO players (first_name, last_name, primary_role)
            VALUES ($1, $2, $3)
            RETURNING *;
        `;
        
        const result = await pool.query(insertQuery, [first_name.trim(), safeLastName, safeRole]);

        res.status(201).json({ success: true, message: "Player added successfully.", data: result.rows[0] });

    } catch (error) {
        console.error("Player Insertion Error:", error);
        res.status(500).json({ error: "Failed to insert player into database." });
    }
});

module.exports = router;