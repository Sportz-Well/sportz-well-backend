'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// 1. ADD PLAYER (With Duplicate Prevention)
router.post('/', async (req, res) => {
    try {
        const { name, dob, gender, role, school_id_no, aadhaar_card_no, std, div, academy_id } = req.body;

        if (!name || !dob) {
            return res.status(400).json({ success: false, message: "Name and DOB are strictly required." });
        }

        const a_id = academy_id || 1; 

        // THE FIX: Check for duplicates in this specific academy before inserting
        const dupeCheck = await pool.query(
            'SELECT id FROM players WHERE name = $1 AND (academy_id = $2 OR school_id = $2)', 
            [name, a_id]
        );
        
        if (dupeCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "A player with this exact name already exists in your Academy." });
        }

        const insertQuery = `
            INSERT INTO players (
                academy_id, school_id, name, date_of_birth, gender, role, 
                school_id_no, aadhaar_card_no, std, div, coach_signal
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Stable') RETURNING *;
        `;
        
        const result = await pool.query(insertQuery, [
            a_id, a_id, name, dob, gender || 'Not Specified', role || 'Unassigned',
            school_id_no || null, aadhaar_card_no || null, std || null, div || null
        ]);

        res.status(201).json({ success: true, player: result.rows[0] });
    } catch (err) {
        console.error("Add Player Error:", err);
        res.status(500).json({ success: false, message: "Server error while adding player." });
    }
});

// 2. GET ALL PLAYERS FOR DIRECTORY (Filters by Academy, Fixes DOB mapping)
router.get('/', async (req, res) => {
    try {
        const academyId = req.query.academy_id || 1; 
        
        // THE FIX: "date_of_birth AS dob" forces the DB to hand the data to the frontend using the name it expects
        const result = await pool.query(
            'SELECT *, date_of_birth AS dob FROM players WHERE academy_id = $1 OR school_id = $1 ORDER BY name ASC', 
            [academyId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. GET SINGLE INDIVIDUAL PLAYER (For the Profile Page)
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT *, date_of_birth AS dob FROM players WHERE id = $1', 
            [req.params.id]
        );
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Player not found." });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. SECURE CASCADE DELETE (Wipes Player + All their data histories)
router.delete('/:id', async (req, res) => {
    try {
        const playerId = req.params.id;

        // Start a database transaction so if one fails, they all cancel to prevent data corruption
        await pool.query('BEGIN');

        // Wipe all associated child data first (Cascading Delete)
        await pool.query('DELETE FROM match_logs WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM daily_attendance WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM weekly_assessments WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM coach_remarks WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM video_logs WHERE player_id = $1', [playerId]);

        // Finally, delete the actual player record
        const result = await pool.query('DELETE FROM players WHERE id = $1 RETURNING *', [playerId]);

        await pool.query('COMMIT');

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, message: "Player not found." });
        }

        res.json({ success: true, message: "Player and all associated data permanently deleted." });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Delete Player Error:", err);
        res.status(500).json({ success: false, message: "Failed to permanently delete player." });
    }
});

module.exports = router;