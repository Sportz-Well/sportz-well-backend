'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST: Save Quarterly Assessments
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        // SMART PAYLOAD PARSING: Accept the data however the frontend sends it
        let assessments = req.body.assessments;
        let quarter = req.body.quarter || 'Q1 2026';
        let sid = req.body.school_id || 1;

        // Failsafe: If the frontend sent the array directly as the body
        if (Array.isArray(req.body)) {
            assessments = req.body;
        }

        if (!assessments || !Array.isArray(assessments) || assessments.length === 0) {
            return res.status(400).json({ success: false, message: "Invalid assessment data. No data received." });
        }

        await client.query('BEGIN'); // Start transaction

        for (let act of assessments) {
            // Handle different frontend ID names
            const playerId = act.playerId || act.id || act.player_id; 
            
            if (!playerId) continue; // Skip empty rows safely

            const physical = Number(act.physical) || 0;
            const skill = Number(act.skill) || 0;
            const mental = Number(act.mental) || 0;
            const coach = Number(act.coach) || 0;
            
            const totalScore = ((physical + skill + mental + coach) / 4).toFixed(1);
            
            let signal = 'Stable';
            if (totalScore >= 7.5) signal = 'Optimal';
            else if (totalScore < 5.0) signal = 'At Risk';

            // 1. Insert into assessments table
            await client.query(
                `INSERT INTO assessments (user_id, school_id, quarter, physical_score, skill_score, mental_score, coach_score, total_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [playerId, sid, quarter, physical, skill, mental, coach, totalScore]
            );

            // 2. Update the players table
            await client.query(
                `UPDATE players SET latest_score = $1, coach_signal = $2 WHERE id = $3`,
                [totalScore, signal, playerId]
            );
        }

        await client.query('COMMIT'); // Save all changes
        res.status(201).json({ success: true, message: 'Assessments saved successfully' });
    } catch (err) {
        await client.query('ROLLBACK'); // Cancel changes if anything fails
        console.error('Save Assessment Error:', err);
        res.status(500).json({ success: false, message: 'Failed to save assessment', details: err.message });
    } finally {
        client.release();
    }
});

// GET: Fetch assessments
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM assessments ORDER BY created_at DESC');
        res.json({ success: true, data: result.rows });
    } catch (err) {
        console.error('Fetch Assessments Error:', err);
        res.status(500).json({ success: false, message: 'Failed to fetch assessments' });
    }
});

module.exports = router;