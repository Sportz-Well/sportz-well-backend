'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const AnalyticsService = require('../analyticsService');

const analyticsService = new AnalyticsService(db);

// 🔥 TEST ROUTE (keep it)
router.get('/test', (req, res) => {
  res.json({
    message: 'NEW CODE DEPLOYED SUCCESSFULLY'
  });
});

// 🔥 DASHBOARD (USING DB)
router.get('/dashboard', async (req, res) => {
  try {
    const schoolId = 1; // Default for demo
    const stats = await analyticsService.getDashboardAnalytics(schoolId);
    
    // Count total players and at-risk players
    const playersRes = await db.query('SELECT COUNT(*) as count FROM players WHERE school_id = $1', [schoolId]);
    const atRiskRes = await db.query('SELECT COUNT(*) as count FROM assessment_sessions WHERE school_id = $1 AND risk_status = $2 AND test_date = (SELECT MAX(test_date) FROM assessment_sessions WHERE school_id = $1)', [schoolId, 'At Risk']);

    res.json({
      success: true,
      total_players: Number(playersRes.rows[0]?.count || 0),
      avg_score: Math.round(stats.average_score || 0),
      at_risk: Number(atRiskRes.rows[0]?.count || 0)
    });
  } catch (error) {
    console.error('[dashboard] Error:', error.message);
    res.json({
      success: true,
      total_players: 0,
      avg_score: 0,
      at_risk: 0
    });
  }
});

// 🔥 TREND (WRAPPED IN TRY/CATCH)
router.get('/trend', async (req, res) => {
  try {
    const schoolId = 1; // Default for demo
    const trendData = await analyticsService.getSchoolTrend(schoolId);

    // Ensure we always return an array (even if empty) to prevent frontend map() crash
    if (!trendData || !Array.isArray(trendData)) {
      return res.json({
        success: true,
        data: []
      });
    }

    res.json({
      success: true,
      data: trendData.map(row => ({
        label: row.test_date ? new Date(row.test_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' }) : 'N/A',
        avg_score: Math.round(row.avg_score || 0)
      }))
    });
  } catch (error) {
    console.error('[trend] Error:', error.message);
    // CRITICAL: Return empty array to prevent data.map crash on frontend
    res.json({
      success: true,
      data: []
    });
  }
});

module.exports = router;
