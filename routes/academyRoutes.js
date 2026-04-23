'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); 

// ==========================================================
// ACADEMY DIRECTORY ENDPOINT
// ==========================================================
router.get('/', async (req, res) => {
    try {
        // Fetch all academies, ordered by creation (Singhania and Automotive first)
        const result = await db.query('SELECT id, name FROM academies ORDER BY id ASC');
        
        res.status(200).json({
            success: true,
            data: result.rows
        });
    } catch (err) {
        console.error("[DB ERROR] Failed to fetch academies:", err);
        res.status(500).json({ success: false, error: 'Failed to retrieve academy list.' });
    }
});

module.exports = router;