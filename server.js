'use strict';

const express = require('express');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// ROUTES
const playerRoutes = require('./routes/playerRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const analyticsRoutes = require('./routes/analytics');
const demoRoutes = require('./routes/demoRoutes');

// ✅ AUTH ROUTE (CRITICAL)
const authRoutes = require('./routes/authRoutes');

// Route Mapping
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/assessment', assessmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/demo', demoRoutes);

// ✅ AUTH ROUTE CONNECTED
app.use('/api/v1/auth', authRoutes);

// Health Check
app.get('/', (req, res) => {
  res.send('API is running...');
});

// Server Start
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});