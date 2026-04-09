'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Add Player (Relaxed Constraints)
router.post('/', async (req, res) => {
    try {
        const { name, dob, gender, role, school_id_no, aadhaar_card_no, std, div, school_id } = req.body;

        if (!name || !dob) {
            return res.status(400).json({ success: false, message: "Name and DOB are strictly required." });
        }

        const sid = school_id || 1; 

        const insertQuery = `
            INSERT INTO players (
                school_id, name, date_of_birth, gender, role, 
                school_id_no, aadhaar_card_no, std, div, coach_signal
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Stable') RETURNING *;
        `;
        
        const result = await pool.query(insertQuery, [
            sid, name, dob, gender || 'Not Specified', role || 'Unassigned',
            school_id_no || null, aadhaar_card_no || null, std || null, div || null
        ]);

        res.status(201).json({ success: true, player: result.rows[0] });
    } catch (err) {
        console.error("Add Player Error:", err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// Get Players
router.get('/', async (req, res) => {
    try {
        const schoolId = 1; 
        const result = await pool.query('SELECT * FROM players WHERE school_id = $1 ORDER BY name ASC', [schoolId]);
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;