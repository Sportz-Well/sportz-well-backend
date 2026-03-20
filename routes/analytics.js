'use strict';

const express = require('express');
const router = express.Router();

const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware'); // adjust if needed

// --------------------
// ROUTES
// --------------------

router.get('/dashboard', authMiddleware, analyticsController.getDashboardAnalytics);
router.get('/trend', authMiddleware, analyticsController.getSchoolTrend);

module.exports = router;