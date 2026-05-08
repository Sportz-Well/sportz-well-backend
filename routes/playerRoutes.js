// routes/playerRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/authMiddleware');

// ---------------------------------------------------------
// EMERGENCY AUTO-FIX ROUTE (Keep this just in case)
// ---------------------------------------------------------
router.get('/fix-db', async (req, res) => {
    try {
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS date_of_birth VARCHAR(50);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS gender VARCHAR(50);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS std_div VARCHAR(50);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS school_id VARCHAR(100);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS mobile_no VARCHAR(20);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS latest_score VARCHAR(10);`);
        await pool.query(`ALTER TABLE players ADD COLUMN IF NOT EXISTS coach_signal VARCHAR(50);`);
        
        res.setHeader('Content-Type', 'text/html');
        res.send(`
            <div style="font-family: sans-serif; text-align: center; padding: 50px;">
                <h1 style="color: #10B981;">✅ Database Patched Successfully!</h1>
                <p>All required columns have been securely added.</p>
            </div>
        `);
    } catch (err) {
        res.setHeader('Content-Type', 'text/html');
        res.send(`<h1 style="color: #EF4444; text-align:center;">❌ Error: ${err.message}</h1>`);
    }
});

router.use(authMiddleware);

// ---------------------------------------------------------
// SECURED ROUTE: ADD NEW PLAYER (Bulletproof Data Formatting)
// ---------------------------------------------------------
router.post('/add', async (req, res) => {
    // 1. Extract raw data from frontend
    let { name, date_of_birth, gender, primary_role, std_div, school_id, mobile_no } = req.body;
    
    // 2. BULLETPROOFING: Convert empty strings ("") or undefined to explicit NULL for PostgreSQL
    const cleanName = name ? name.trim() : 'Unknown Player';
    const cleanDOB = (date_of_birth && date_of_birth.trim() !== '') ? date_of_birth : null;
    const cleanGender = (gender && gender.trim() !== '') ? gender : null;
    const cleanRole = (primary_role && primary_role.trim() !== '') ? primary_role : 'Athlete';
    const cleanStdDiv = (std_div && std_div.trim() !== '') ? std_div : null;
    const cleanSchoolId = (school_id && school_id.trim() !== '') ? school_id : null;
    const cleanMobile = (mobile_no && mobile_no.trim() !== '') ? mobile_no : null;

    // 3. Fallback ID extraction to prevent token errors
    const academy_id = req.user.academy_id || req.user.school_id || 1; 

    try {
        const result = await pool.query(
            `INSERT INTO players (name, date_of_birth, gender, role, academy_id, std_div, school_id, mobile_no) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
            [cleanName, cleanDOB, cleanGender, cleanRole, academy_id, cleanStdDiv, cleanSchoolId, cleanMobile]
        );
        res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error("Database Insert Error:", err.message);
        res.status(500).json({ success: false, error: "Database rejected the entry.", details: err.message });
    }
});

// ---------------------------------------------------------
// SECURED ROUTE: GET ALL PLAYERS 
// ---------------------------------------------------------
router.get('/', async (req, res) => {
    let targetAcademyId = req.user.academy_id || req.user.school_id || 1;

    if (req.user.role === 'admin' && req.query.academy_id) {