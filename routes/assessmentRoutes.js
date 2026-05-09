'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../config/db');

// -------------------------------------------------------
// AUTO-MIGRATION: Adds match_score column if it doesn't exist
// Runs once when backend starts. Safe to run multiple times.
// -------------------------------------------------------
(async () => {
    try {
        await pool.query(`
            ALTER TABLE weekly_assessments 
            ADD COLUMN IF NOT EXISTS match_score NUMERIC(4,2) DEFAULT 0
        `);
        console.log('✅ weekly_assessments.match_score column verified.');
    } catch (err) {
        console.error('⚠️ Migration check failed (non-critical):', err.message);
    }
})();

// -------------------------------------------------------
// POST /api/v1/assessments
// Saves weekly assessment scores for one or more players
// -------------------------------------------------------
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("📥 Assessment payload received:", JSON.stringify(req.body));

        let assessments = [];
        if (req.body.assessments && Array.isArray(req.body.assessments)) {
            assessments = req.body.assessments;
        } else if (Array.isArray(req.body)) {
            assessments = req.body;
        } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            assessments = [req.body];
        }

        if (assessments.length === 0) {
            return res.status(400).json({ error: "No assessment data provided." });
        }

        await client.query('BEGIN');

        for (let item of assessments) {
            const player_id     = item.player_id;
            const skill_score   = item.skill_score   || 0;
            const match_score   = item.match_score   || 0;
            const fitness_score = item.fitness_score || 0;
            const mental_score  = item.mental_score  || 0;

            if (!player_id) {
                throw new Error(`Missing player_id in entry: ${JSON.stringify(item)}`);
            }

            await client.query(
                `INSERT INTO weekly_assessments 
                    (player_id, assessment_date, fitness_score, skill_score, mental_score, match_score)
                 VALUES ($1, CURRENT_DATE, $2, $3, $4, $5)`,
                [player_id, fitness_score, skill_score, mental_score, match_score]
            );
        }

        await client.query('COMMIT');

        console.log(`✅ ${assessments.length} assessment(s) saved.`);
        res.status(200).json({ 
            success: true, 
            message: `${assessments.length} assessment(s) saved successfully.` 
        });

    } catch (error) {
        await client.query('ROLLBACK');
        console.error("❌ Assessment Save Error:", error.message);
        res.status(500).json({ error: "Failed to save assessments: " + error.message });
    } finally {
        client.release();
    }
});

module.exports = router;