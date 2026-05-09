require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// ==========================================
// MIDDLEWARE
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
// SERVER INITIALIZATION
// ==========================================
app.get('/', (req, res) => {
    res.status(200).json({ message: "SWPI API is live and secure." });
});

app.listen(PORT, () => {
    console.log(`SWPI Backend is securely running on port ${PORT}`);
});