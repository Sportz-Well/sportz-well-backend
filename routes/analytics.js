'use strict';

const express = require('express');
const analyticsController = require('../controllers/analyticsController');
const authMiddleware = require('../middleware/authMiddleware');

const router = express.Router();

router.get('/dashboard', authMiddleware, analyticsController.getDashboardAnalytics);
router.get('/dashboard/trend', authMiddleware, analyticsController.getSchoolTrend);
router.get('/trend', authMiddleware, analyticsController.getSchoolTrend);

module.exports = router;
