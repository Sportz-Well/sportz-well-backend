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
app.use(express.json());

// ==========================================
// ROUTE IMPORTS
// ==========================================
// Restoring your core MVP routes
const authRoutes = require('./routes/authRoutes'); 
const playerRoutes = require('./routes/playerRoutes'); 

// The new AI Biometric pipe
const biometricRoutes = require('./routes/biometricRoutes');

// ==========================================
// ROUTE REGISTRATION
// ==========================================
// Restoring the core API endpoints
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);

// Registering the new AI pipe
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