'use strict';

const express = require('express');
const cors = require('cors');

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());

// ✅ ROUTES IMPORT
const playerRoutes = require('./routes/playerRoutes');
const assessmentRoutes = require('./routes/assessmentRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const demoRoutes = require('./routes/demoRoutes');
const authRoutes = require('./routes/authRoutes');
const adminRoutes = require('./routes/adminRoutes'); // ✅ NEW

// ✅ ROUTE MAPPING
app.use('/api/v1/players', playerRoutes);
app.use('/api/v1/assessment', assessmentRoutes);
app.use('/api/v1/analytics', analyticsRoutes);
app.use('/api/v1/demo', demoRoutes);
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/admin', adminRoutes); // ✅ NEW

// ✅ HEALTH CHECK
app.get('/', (req, res) => {
  res.send('Sportz-Well Backend Running ✅');
});

// ✅ SERVER START
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});