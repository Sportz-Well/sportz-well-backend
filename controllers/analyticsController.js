'use strict';

const AnalyticsService = require('../analyticsService');
const db = require('../db'); // ✅ FIXED (uses your existing DB file)

// Initialize service
const analyticsService = new AnalyticsService(db);

// --------------------
// GET DASHBOARD
// --------------------
const getDashboardAnalytics = async (req, res) => {
  try {
    const schoolId = req.user?.school_id;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: school_id missing'
      });
    }

    const data = await analyticsService.getDashboardAnalytics(schoolId);

    return res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('[AnalyticsController] Dashboard Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard analytics'
    });
  }
};

// --------------------
// GET TREND
// --------------------
const getSchoolTrend = async (req, res) => {
  try {
    const schoolId = req.user?.school_id;

    if (!schoolId) {
      return res.status(401).json({
        success: false,
        message: 'Unauthorized: school_id missing'
      });
    }

    const trend = await analyticsService.getSchoolTrend(schoolId);

    return res.status(200).json({
      success: true,
      data: trend,
      metadata: {
        trendBasis: 'average_all_players'
      }
    });

  } catch (error) {
    console.error('[AnalyticsController] Trend Error:', error);

    return res.status(500).json({
      success: false,
      message: 'Failed to fetch trend data'
    });
  }
};

module.exports = {
  getDashboardAnalytics,
  getSchoolTrend
};