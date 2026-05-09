'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

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

        // Get school_id from first player in database
        const schoolResult = await pool.query(
            `SELECT school_id FROM players WHERE id = $1 LIMIT 1`,
            [assessments[0].player_id]
        );
        const school_id = schoolResult.rows[0]?.school_id || 1;

        await client.query('BEGIN');

        for (let item of assessments) {
            const player_id        = item.player_id;
            const technical_score  = item.skill_score   || 0;
            const match_score      = item.match_score   || 0;
            const physical_score   = item.fitness_score || 0;
            const mental_score     = item.mental_score  || 0;

            if (!player_id) {
                throw new Error(`Missing player_id in entry: ${JSON.stringify(item)}`);
            }

            await client.query(
                `INSERT INTO weekly_assessments 
                    (player_id, school_id, assessment_date, physical_score, technical_score, mental_score, match_score)
                 VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)`,
                [player_id, school_id, physical_score, technical_score, mental_score, match_score]
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