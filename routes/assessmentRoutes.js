'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST: Save Quarterly Assessments
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("📥 RECEIVED PAYLOAD:", req.body); // Tells Render exactly what the frontend sent

        // --- THE ULTIMATE PAYLOAD PARSER ---
        let assessments = [];
        let quarter = req.body.quarter || 'Q1 2026';
        let sid = req.body.school_id || 1;

        if (req.body.assessments && Array.isArray(req.body.assessments)) {
            assessments = req.body.assessments; // Format 1: A labeled list
        } else if (Array.isArray(req.body)) {
            assessments = req.body; // Format 2: A direct list
        } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            assessments = [req.body]; // Format 3: A single player object (This is likely what your MVP is doing)
        }

        if (!assessments || assessments.length === 0) {
            console.error("❌ Parser failed to find assessment data.");
            return res.status(400).json({ success: false, message: "Server did not receive valid data to save." });
        }

        await client.query('BEGIN'); // Start transaction

        let savedCount = 0;

        for (let act of assessments) {
            const playerId = act.playerId || act.id || act.player_id || act.userId; 
            if (!playerId) continue; 

            const physical = Number(act.physical || act.physical_score) || 0;
            const skill = Number(act.skill || act.skill_score) || 0;
            const mental = Number(act.mental || act.mental_score) || 0;
            const coach = Number(act.coach || act.coach_score) || 0;
            
            const totalScore = ((physical + skill + mental + coach) / 4).toFixed(1);
            
            let signal = 'Stable';
            if (totalScore >= 7.5) signal = 'Optimal';
            else if (totalScore < 5.0) signal = 'At Risk';

            // Insert into assessments table
            await client.query(
                `INSERT INTO assessments (user_id, school_id, quarter, physical_score, skill_score, mental_score, coach_score, total_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [playerId, sid, quarter, physical, skill, mental, coach, totalScore]
            );

            // Update the players table
            await client.query(
                `UPDATE players SET latest_score = $1, coach_signal = $2 WHERE id = $3`,
                [totalScore, signal, playerId]
            );
            savedCount++;
        }

        await client.query('COMMIT'); 
        console.log(`✅ Successfully saved ${savedCount} assessments.`);
        res.status(201).json({ success: true, message: 'Assessments saved successfully' });
    } catch (err) {
        await client.query('ROLLBACK'); 
        console.error('❌ Save Assessment Error:', err);
        res.status(500).json({ success: false, message: 'Database failed to save', details: err.message });
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
        res.status(500).json({ success: false, message: 'Failed to fetch assessments' });
    }
});

module.exports = router;