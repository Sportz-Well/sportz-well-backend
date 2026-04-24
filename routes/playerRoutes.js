'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
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
        // Crack open the token to get the cryptographically verified identity
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret_key_change_this_in_production');
        req.user = decoded; // Contains id, email, role, and the crucial academy_id
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }
};

// Apply security middleware to ALL routes in this file
router.use(verifyCoach);

// ==========================================================
// 1. ADD PLAYER (With Secure Tenant Injection)
// ==========================================================
router.post('/', async (req, res) => {
    try {
        const { name, dob, gender, role, school_id_no, aadhaar_card_no, std, div } = req.body;
        
        // CTO FIX: Ignore frontend claims. Extract Academy ID strictly from the secure token.
        // If an admin is creating a player, we allow them to pass the academy_id, otherwise enforce their own.
        const secureAcademyId = (req.user.role === 'admin' && req.body.academy_id) 
            ? req.body.academy_id 
            : req.user.academy_id; 

        if (!name || !dob) {
            return res.status(400).json({ success: false, message: "Name and DOB are strictly required." });
        }

        // Check for duplicates strictly within their own academy
        const dupeCheck = await pool.query(
            'SELECT id FROM players WHERE name = $1 AND academy_id = $2', 
            [name, secureAcademyId]
        );
        
        if (dupeCheck.rows.length > 0) {
            return res.status(400).json({ success: false, message: "A player with this exact name already exists in this Academy." });
        }

        const insertQuery = `
            INSERT INTO players (
                academy_id, name, date_of_birth, gender, role, 
                school_id_no, aadhaar_card_no, std, div, coach_signal
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'Stable') RETURNING *;
        `;
        
        const result = await pool.query(insertQuery, [
            secureAcademyId, name, dob, gender || 'Not Specified', role || 'Unassigned',
            school_id_no || null, aadhaar_card_no || null, std || null, div || null
        ]);

        res.status(201).json({ success: true, player: result.rows[0] });
    } catch (err) {
        console.error("Add Player Error:", err);
        res.status(500).json({ success: false, message: "Server error while adding player." });
    }
});

// ==========================================================
// 2. GET ALL PLAYERS FOR DIRECTORY (Secure Filter + Admin Override)
// ==========================================================
router.get('/', async (req, res) => {
    try {
        let targetAcademyId = req.user.academy_id; 

        // SUPER ADMIN OVERRIDE
        if (req.user.role === 'admin' && req.query.academy_id) {
            targetAcademyId = req.query.academy_id;
        }
        
        const result = await pool.query(
            'SELECT *, date_of_birth AS dob FROM players WHERE academy_id = $1 ORDER BY name ASC', 
            [targetAcademyId]
        );
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================================
// 3. GET SINGLE INDIVIDUAL PLAYER (Cross-Tenant Prevented + Admin Override)
// ==========================================================
router.get('/:id', async (req, res) => {
    try {
        let queryStr = 'SELECT *, date_of_birth AS dob FROM players WHERE id = $1 AND academy_id = $2';
        let queryParams = [req.params.id, req.user.academy_id];

        // SUPER ADMIN OVERRIDE
        if (req.user.role === 'admin') {
            queryStr = 'SELECT *, date_of_birth AS dob FROM players WHERE id = $1';
            queryParams = [req.params.id];
        }

        const result = await pool.query(queryStr, queryParams);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ message: "Player not found, or you do not have permission to view them." });
        }
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ==========================================================
// 4. SECURE CASCADE DELETE (Wipes Player + Data + Admin Override)
// ==========================================================
router.delete('/:id', async (req, res) => {
    try {
        const playerId = req.params.id;
        
        let verifyOwnership;
        
        // SUPER ADMIN OVERRIDE
        if (req.user.role === 'admin') {
            verifyOwnership = await pool.query('SELECT id FROM players WHERE id = $1', [playerId]);
        } else {
            verifyOwnership = await pool.query(
                'SELECT id FROM players WHERE id = $1 AND academy_id = $2', 
                [playerId, req.user.academy_id]
            );
        }

        if (verifyOwnership.rows.length === 0) {
            return res.status(403).json({ success: false, message: "Forbidden: You cannot delete a player from another academy." });
        }

        // Start a database transaction so if one fails, they all cancel
        await pool.query('BEGIN');

        // Wipe all associated child data first
        await pool.query('DELETE FROM match_logs WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM daily_attendance WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM weekly_assessments WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM coach_remarks WHERE player_id = $1', [playerId]);
        await pool.query('DELETE FROM video_logs WHERE player_id = $1', [playerId]);

        // Delete the actual player record
        await pool.query('DELETE FROM players WHERE id = $1', [playerId]);

        await pool.query('COMMIT');

        res.json({ success: true, message: "Player and all associated data permanently deleted." });

    } catch (err) {
        await pool.query('ROLLBACK');
        console.error("Delete Player Error:", err);
        res.status(500).json({ success: false, message: "Failed to permanently delete player." });
    }
});

module.exports = router;