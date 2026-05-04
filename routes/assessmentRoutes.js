'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

// POST: Save Quarterly Assessments
router.post('/', async (req, res) => {
    const client = await pool.connect();
    try {
        console.log("🚨 RECEIVED PAYLOAD:", req.body);

        // --- THE ULTIMATE PAYLOAD PARSER ---
        let assessments = [];
        let quarter = req.body.quarter || 'Q1 2026';
        let sid = req.body.school_id || 1;

        if (req.body.assessments && Array.isArray(req.body.assessments)) {
            assessments = req.body.assessments; // Format 1: A labeled list
        } else if (Array.isArray(req.body)) {
            assessments = req.body; // Format 2: A direct list
        } else if (typeof req.body === 'object' && Object.keys(req.body).length > 0) {
            assessments = [req.body]; // Format 3: A single player object
        }

        if (assessments.length === 0) {
            return res.status(400).json({ error: "No assessment data provided." });
        }

        await client.query('BEGIN');
        for (let item of assessments) {
            const { player_id, fitness_score, skill_score, mental_score } = item;
            await client.query(
                `INSERT INTO weekly_assessments (player_id, assessment_date, fitness_score, skill_score, mental_score)
                 VALUES ($1, CURRENT_DATE, $2, $3, $4)`,
                [player_id, fitness_score, skill_score, mental_score]
            );
        }
        await client.query('COMMIT');
        
        res.status(200).json({ success: true, message: "Assessments saved successfully." });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error("Assessment Save Error:", error);
        res.status(500).json({ error: "Failed to save assessments." });
    } finally {
        client.release();
    }
});

module.exports = router;