'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // 1. HARDCODED DEMO BYPASS (Failsafe for Pitch)
        if ((email === 'coach@sportzwell.com' || email === 'admin@sportzwell.com') && password === 'demo123') {
            const role = email.includes('admin') ? 'admin' : 'coach';
            // Sign a token valid for 24 hours
            const token = jwt.sign(
                { email, role, school_id: 1 }, 
                process.env.JWT_SECRET || 'swpi-secret-key', 
                { expiresIn: '24h' }
            );
            
            console.log(`✅ Demo Bypass Used: ${email} logged in successfully.`);
            
            return res.json({
                success: true,
                token,
                user: { email, role, school_id: 1 }
            });
        }

        // 2. STANDARD DB CHECK (For real users later)
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        const user = result.rows[0];

        // 3. SMART PASSWORD CHECK (Handles both bcrypt and plain text gracefully)
        let isMatch = false;
        if (user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
            isMatch = await bcrypt.compare(password, user.password);
        } else {
            isMatch = (password === user.password); // Fallback for old plaintext passwords
        }

        if (!isMatch) {
            return res.status(401).json({ success: false, message: 'Invalid credentials' });
        }

        // 4. SUCCESS
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role, school_id: user.school_id || 1 },
            process.env.JWT_SECRET || 'swpi-secret-key',
            { expiresIn: '24h' }
        );

        res.json({
            success: true,
            token,
            user: { id: user.id, email: user.email, role: user.role, school_id: user.school_id || 1 }
        });

    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

module.exports = router;