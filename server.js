'use strict';

require('dotenv').config();
const express = require('express');
const cors = require('cors');

// ==========================================
// SECURITY PACKAGES
// helmet: adds 11 HTTP security headers to every response
//   — blocks clickjacking, MIME sniffing, XSS attacks
// rateLimit: limits how many requests one IP can make
//   — prevents brute force attacks and data scraping
// ==========================================
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// SECURITY MIDDLEWARE — applied first, before anything else
// ==========================================

// Helmet: sets secure HTTP headers on every single API response
app.use(helmet());

// Rate Limiter — General API
// Rule: max 100 requests per 15 minutes per IP address
// What this means in plain English: a normal coach doing their job
// will never hit this limit. An attacker trying to scrape or
// brute-force the API will be blocked automatically.
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many requests from this device. Please wait 15 minutes and try again.'
    }
});

// Rate Limiter — Login endpoint specifically
// Rule: max 10 login attempts per 15 minutes per IP address
// What this means: if someone is trying to guess passwords,
// they get 10 tries then they are locked out for 15 minutes.
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
        success: false,
        error: 'Too many login attempts from this device. Please wait 15 minutes and try again.'
    }
});

// Apply general rate limit to all API routes
app.use('/api/', generalLimiter);

// Apply strict login rate limit to auth routes only
app.use('/api/v1/auth/login', loginLimiter);

// ==========================================
// STANDARD MIDDLEWARE
// ==========================================
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// ROUTE IMPORTS
// ==========================================
const authRoutes = require('./routes/authRoutes');
const playerRoutes = require('./routes/playerRoutes');
const biometricRoutes = require('./routes/biometricRoutes');
const operationsRoutes = require('./routes/operationsRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');

// ==========================================
// ROUTE REGISTRATION
// ==========================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/biometrics', biometricRoutes);
app.use('/api/v1/operations', operationsRoutes);
app.use('/api/v1/assessments', assessmentRoutes);

// ==========================================
// HEALTH CHECK — keep-warm ping endpoint
// Called every 14 minutes by cron-job.org
// Prevents Render backend from sleeping
// Excluded from rate limiting — it is a server ping, not an API call
// ==========================================
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        service: 'SWPI Backend',
        timestamp: new Date().toISOString()
    });
});

// ==========================================
// ROOT
// ==========================================
app.get('/', (req, res) => {
    res.status(200).json({ message: "SWPI API is live and secure." });
});

// ==========================================
// SERVER INITIALIZATION
// ==========================================
app.listen(PORT, () => {
    console.log(`SWPI Backend is securely running on port ${PORT}`);
});