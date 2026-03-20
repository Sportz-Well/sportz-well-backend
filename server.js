'use strict';

const express = require('express');
const cors = require('cors');

const app = express();

// --------------------
// MIDDLEWARE
// --------------------
app.use(cors());
app.use(express.json());

// --------------------
// ROUTES IMPORT
// --------------------
const authRoutes = require('./routes/authRoutes');
const playerRoutes = require('./routes/playerRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const analyticsRoutes = require('./routes/analytics'); // ✅ IMPORTANT

// --------------------
// ROUTES MOUNTING
// --------------------
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/assessments', assessmentRoutes);
app.use('/api/v1/dashboard', dashboardRoutes);
app.use('/api/v1/analytics', analyticsRoutes); // ✅ FIX ADDED

// --------------------
// HEALTH CHECK
// --------------------
app.get('/', (req, res) => {
  res.send('Sportz-Well Backend Running');
});

// --------------------
// 404 HANDLER
// --------------------
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`
  });
});

// --------------------
// SERVER START
// --------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});