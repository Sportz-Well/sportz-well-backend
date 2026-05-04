// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors());

// THE FIX: Increase the default 100kb limit to 50mb to allow Base64 Image uploads
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// ==========================================
// ROUTE IMPORTS
// ==========================================
const authRoutes = require('./routes/authRoutes'); 
const playerRoutes = require('./routes/playerRoutes'); 
const biometricRoutes = require('./routes/biometricRoutes');

// ==========================================
// ROUTE REGISTRATION
// ==========================================
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/biometrics', biometricRoutes);

// ==========================================
// SERVER INITIALIZATION
// ==========================================
app.get('/', (req, res) => {
    res.status(200).json({ message: "SWPI API is live and secure." });
});

app.listen(PORT, () => {
    console.log(`🚀 SWPI Backend is securely running on port ${PORT}`);
});