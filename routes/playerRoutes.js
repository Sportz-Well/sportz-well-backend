// routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// ---------------------------------------------------------
// EMERGENCY AUTO-FIX ROUTE: Fixes missing DB columns
// ---------------------------------------------------------
router.get('/fix-db', async (req, res) => {
    try {
        // Safely add any missing columns to prevent 500 crashes
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(50);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS gender VARCHAR(50);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS std_div VARCHAR(50);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS school_id VARCHAR(100);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(20);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS latest_score VARCHAR(10);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS coach_signal VARCHAR(50);`);

        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #10B981;">✅ Database Patched Successfully!</h1>
                <p>All required columns have been securely added to the players table.</p>
                <p><strong>You may now close this tab and refresh your SWPI dashboard.</strong></p>
            </div>
        `);
    } catch (err) {
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #EF4444;">❌ Database Patch Failed</h1>
                <p>Error details: ${err.message}</p>
            </div>
        `);
    }
});

// APPLY SECURITY TO EVERYTHING BELOW THIS LINE
router.use(authMiddleware);

// ---------------------------------------------------------
// SECURED ROUTE: ADD NEW PLAYER
// ---------------------------------------------------------
router.post('/add', async (req, res) => {
    let { name, date_of_birth, gender, primary_role, std_div, school_id, mobile_no } = req.body;
    
    // Handle optional fields safely
    std_div = std_div || null;
    school_id = school_id || null;
    mobile_no = mobile_no || null;
    date_of_birth = date_of_birth || null;
    gender = gender || null;

    // Fallback ID to prevent crashes if token is slightly malformed
    const academy_id = req.user.academy_id || req.user.school_id || 1; 

    try {
        const result = await pool.query(
            `INSERT INTO players (name, date_of_birth, gender, role, academy_id, std_div, school_id, mobile_no) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [name, date_of_birth, gender, primary_role, academy_id, std_div, school_id, mobile_no]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Database Insert Error:", err.message);
        res.status(500).json({ success: false, error: "Failed to securely add player.", details: err.message });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET ALL PLAYERS 
// ---------------------------------------------------------
router.get('/', async (req, res) => {
    // Fallback ID to prevent crashes
    let targetAcademyId = req.user.academy_id || req.user.school_id || 1;

    if (req.user.role === 'admin' && req.query.academy_id) {
        targetAcademyId = req.query.academy_id;
    }

    try {
        const result = await pool.query(
            `SELECT id, name, date_of_birth, gender, role, std_div, school_id, mobile_no, latest_score, coach_signal 
             FROM players 
             WHERE academy_id = $1 
             ORDER BY name ASC`,
            [targetAcademyId]
        );
        res.status(200).json(result.rows);
    } catch (err) {
        console.error("Database Fetch Error:", err.message);
        res.status(500).json({ error: "Failed to securely fetch roster.", details: err.message });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET SINGLE PLAYER PROFILE
// ---------------------------------------------------------
router.get('/:id', async (req, res) => {
    const playerId = req.params.id;
    const academy_id = req.user.academy_id || req.user.school_id || 1;

    try {
        let query = `SELECT * FROM players WHERE id = $1 AND academy_id = $2`;
        let params = [playerId, academy_id];

        if (req.user.role === 'admin') {
            query = `SELECT * FROM players WHERE id = $1`;
            params = [playerId];
        }

        const result = await pool.query(query, params);
        
        if (result.rows.length === 0) {
            return res.status(404).json({ error: "Player not found or access denied." });
        }
        
        res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error("Database Fetch Single Player Error:", err.message);
        res.status(500).json({ error: "Failed to fetch player profile.", details: err.message });
    }
});

module.exports = router;