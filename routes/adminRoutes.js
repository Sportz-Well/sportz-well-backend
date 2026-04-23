'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db'); // Pulls from root db.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

// ==========================================================
// SECURITY MIDDLEWARE: STRICT SUPER ADMIN CHECK
// ==========================================================
const verifySuperAdmin = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }
    
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (decoded.role !== 'admin') {
            return res.status(403).json({ error: 'Forbidden: Critical Super Admin access required' });
        }
        
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session' });
    }
};

// ==========================================================
// SUPER ADMIN PROVISIONING ENDPOINT
// ==========================================================
router.post('/provision', verifySuperAdmin, async (req, res) => {
    const { academy_name, coach_name, coach_email, coach_password } = req.body;

    // Strict input validation
    if (!academy_name || !coach_name || !coach_email || !coach_password) {
        return res.status(400).json({ error: 'Missing required provisioning fields.' });
    }

    try {
        // Start Database Transaction
        await db.query('BEGIN');

        // 1. Create the Academy (The Wall)
        const academyResult = await db.query(
            'INSERT INTO academies (name) VALUES ($1) RETURNING id',
            [academy_name]
        );
        const academyId = academyResult.rows[0].id;

        // 2. Hash the Coach's Password Securely
        const saltRounds = 10;
        const passwordHash = await bcrypt.hash(coach_password, saltRounds);

        // 3. Create the Head Coach (The Key)
        await db.query(
            `INSERT INTO users (academy_id, name, email, password_hash, role) 
             VALUES ($1, $2, $3, $4, 'head_coach')`,
            [academyId, coach_name, coach_email, passwordHash]
        );

        // Commit Transaction if everything succeeds
        await db.query('COMMIT');

        res.status(201).json({
            success: true,
            message: 'Academy and Head Coach provisioned successfully.',
            data: {
                academy_id: academyId,
                academy_name: academy_name,
                coach_email: coach_email
            }
        });

    } catch (error) {
        // Rollback Transaction if ANYTHING fails to prevent data corruption
        await db.query('ROLLBACK');
        console.error('Provisioning Error:', error);
        
        // Handle Postgres unique constraint violation (Duplicate Email)
        if (error.code === '23505') { 
            return res.status(400).json({ error: 'Provisioning failed: Email already exists in the system.' });
        }
        
        res.status(500).json({ error: 'Internal server error during provisioning.' });
    }
});

// ==========================================================
// LEGACY ROUTES (DISABLED)
// ==========================================================
router.get('/clean', async (req, res) => {
  res.json({
    success: true,
    message: 'Reset disabled for production stability'
  });
});

router.post('/clean', async (req, res) => {
  res.json({
    success: true,
    message: 'Reset disabled for production stability'
  });
});

module.exports = router;