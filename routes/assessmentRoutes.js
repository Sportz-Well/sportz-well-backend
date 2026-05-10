'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authenticate = require('../middleware/authMiddleware');

// -------------------------------------------------------
// POST /api/v1/assessments
// Saves weekly assessment scores for one or more players
// -------------------------------------------------------
router.post('/', authenticate, async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("📥 Assessment payload received:", JSON.stringify(req.body));

        // Get academy_id securely from the verified token
        const secureAcademyId = req.user.academy_id;

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
            const player_id       = item.player_id;
            const technical_score = item.skill_score   || 0;
            const match_score     = item.match_score   || 0;
            const physical_score  = item.fitness_score || 0;
            const mental_score    = item.mental_score  || 0;

            if (!player_id) {
                throw new Error(`Missing player_id in entry: ${JSON.stringify(item)}`);
            }

            // Security check: confirm this player belongs to the coach's academy
            const playerCheck = await client.query(
                `SELECT id FROM players WHERE id = $1 AND academy_id = $2`,
                [player_id, secureAcademyId]
            );

            if (playerCheck.rows.length === 0) {
                throw new Error(`Access denied: Player ${player_id} does not belong to your academy.`);
            }

            await client.query(
                `INSERT INTO weekly_assessments 
                    (player_id, school_id, assessment_date, physical_score, technical_score, mental_score, match_score)
                 VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6)`,
                [player_id, secureAcademyId, physical_score, technical_score, mental_score, match_score]
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