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
app.use(express.json()); // Parses incoming JSON payloads

// ==========================================
// ROUTE IMPORTS
// ==========================================
// (Keep your existing route imports here)
// const authRoutes = require('./routes/authRoutes');
// const playerRoutes = require('./routes/playerRoutes');

// NEW: Import the Biometric AI pipe
const biometricRoutes = require('./routes/biometricRoutes');


// ==========================================
// ROUTE REGISTRATION
// ==========================================
// (Keep your existing route registrations here)
// app.use('/api/v1/auth', authRoutes);
// app.use('/api/v1/players', playerRoutes);

// NEW: Connect the Biometric AI pipe to the API
app.use('/api/v1/biometrics', biometricRoutes);


// ==========================================
// SERVER INITIALIZATION
// ==========================================
// Basic health check to ensure Render is alive
app.get('/', (req, res) => {
    res.status(200).json({ message: "SWPI API is live and secure." });
});

// Start the server
app.listen(PORT, () => {
    console.log(`🚀 SWPI Backend is securely running on port ${PORT}`);
});