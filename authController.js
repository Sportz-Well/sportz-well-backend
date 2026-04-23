'use strict';

const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../db');

// ==========================================================
// ENTERPRISE AUTHENTICATION CONTROLLER
// ==========================================================
async function login(req, res) {
    try {
        const { email, password } = req.body;

        // 1. Strict Input Validation
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required.' });
        }

        const safeEmail = String(email).trim().toLowerCase();

        // 2. Fetch user from the database
        const result = await db.query(
            'SELECT id, email, password_hash, role, academy_id FROM users WHERE email = $1',
            [safeEmail]
        );

        if (result.rows.length === 0) {
            console.warn(`[AUTH FAILED] Attempted login for non-existent user: ${safeEmail}`);
            return res.status(401).json({ error: 'Invalid login credentials.' });
        }

        const user = result.rows[0];

        // 3. Cryptographic Password Verification
        const match = await bcrypt.compare(password, user.password_hash);

        if (!match) {
            console.warn(`[AUTH FAILED] Invalid password attempt for: ${safeEmail}`);
            return res.status(401).json({ error: 'Invalid login credentials.' });
        }

        // 4. Generate a Secure JSON Web Token (JWT)
        const tokenPayload = {
            id: user.id,
            email: user.email,
            role: user.role,
            academy_id: user.academy_id
        };

        // Note: process.env.JWT_SECRET must be set in your Render environment variables
        const token = jwt.sign(
            tokenPayload, 
            process.env.JWT_SECRET || 'fallback_secret_key_change_this_in_production', 
            { expiresIn: '24h' }
        );

        console.log(`✅ [AUTH SUCCESS] User logged in: ${user.email} (Role: ${user.role}, Academy ID: ${user.academy_id})`);

        return res.json({
            success: true,
            token: token,
            user: {
                id: user.id,
                email: user.email,
                role: user.role,
                academy_id: user.academy_id
            }
        });

    } catch (err) {
        console.error("[AUTH FATAL ERROR] Server Exception during login:", err);
        res.status(500).json({ error: 'Internal server authentication error.' });
    }
}

module.exports = { login };