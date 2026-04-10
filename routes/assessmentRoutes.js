'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST: Save Quarterly Assessments
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        const { assessments, quarter, school_id } = req.body;
        const sid = school_id || 1;
        const qtr = quarter || 'Q1 2026';

        if (!assessments || !Array.isArray(assessments)) {
            return res.status(400).json({ success: false, message: "Invalid assessment data" });
        }

        await client.query('BEGIN'); // Start transaction

        for (let act of assessments) {
            // Handle different frontend payload ID names securely
            const playerId = act.playerId || act.id; 
            
            // Auto-calculate the total average score
            const physical = Number(act.physical) || 0;
            const skill = Number(act.skill) || 0;
            const mental = Number(act.mental) || 0;
            const coach = Number(act.coach) || 0;
            
            const totalScore = ((physical + skill + mental + coach) / 4).toFixed(1);
            
            // Auto-calculate the AI Signal based on the score
            let signal = 'Stable';
            if (totalScore >= 7.5) signal = 'Optimal';
            else if (totalScore < 5.0) signal = 'At Risk';

            // 1. Insert into assessments table using our newly upgraded schema
            await client.query(
                `INSERT INTO assessments (user_id, school_id, quarter, physical_score, skill_score, mental_score, coach_score, total_score)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                [playerId, sid, qtr, physical, skill, mental, coach, totalScore]
            );

            // 2. Update the players table with the latest score and signal
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