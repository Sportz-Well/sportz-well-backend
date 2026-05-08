const express = require('express');
const router = express.Router();
const pool = require('../db'); 

// --- 1. FETCH ALL PLAYERS ---
router.get('/', async (req, res) => {
    try {
        // Removed 'ORDER BY id' to prevent crashes if the ID column is named differently
        const result = await pool.query('SELECT * FROM players');
        res.status(200).json({ success: true, data: result.rows });
    } catch (error) {
        console.error("GET Players Error:", error.message);
        // DIAGNOSTIC HACK: Send the exact SQL error directly to the frontend
        res.status(500).json({ error: `DB Error: ${error.message}` });
    }
});

// --- 2. ADD NEW PLAYER ---
router.post('/', async (req, res) => {
    try {
        const { name, first_name, last_name, role, primary_role } = req.body;

        // Map frontend inputs to the actual DB schema safely
        const finalName = name || (first_name ? `${first_name} ${last_name || ''}`.trim() : 'Unknown Athlete');
        const finalRole = role || primary_role || 'Cricket Player';

        // Assuming database uses 'name' and 'role' based on previous biometric route architecture
        const insertQuery = `
            INSERT INTO players (name, role)
            VALUES ($1, $2)
            RETURNING *;
        `;
        
        const result = await pool.query(insertQuery, [finalName, finalRole]);
        res.status(201).json({ success: true, message: "Player added successfully.", data: result.rows[0] });

    } catch (error) {
        console.error("POST Player Error:", error.message);
        // DIAGNOSTIC HACK: Send the exact SQL error directly to the frontend
        res.status(500).json({ error: `DB Error: ${error.message}` });
    }
});

module.exports = router;