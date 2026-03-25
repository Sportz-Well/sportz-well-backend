'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const AnalyticsService = require('../analyticsService');

const analyticsService = new AnalyticsService(db);

// 🔥 TEST ROUTE
router.get('/test', (req, res) => {
  res.json({
    message: 'NEW CODE DEPLOYED SUCCESSFULLY'
  });
});

// 🔥 DASHBOARD (Explicitly filtered by school_id=1)
router.get('/dashboard', async (req, res) => {
  try {
    const schoolId = 1; // Default for demo context

    // 1. Get Analytics (Avg Score)
    const stats = await analyticsService.getDashboardAnalytics(schoolId);
    
    // 2. Count Total Players
    const playersRes = await db.query(
      'SELECT COUNT(*) as count FROM players WHERE school_id = $1', 
      [schoolId]
    );

    // 3. Count At Risk Players (Latest assessment per player)
    // Counts distinct user_ids where the MOST RECENT test_date record has 'At Risk' status
    const atRiskRes = await db.query(`
      SELECT COUNT(*) as count 
      FROM (
        SELECT DISTINCT ON (user_id) risk_status
        FROM assessment_sessions
        WHERE school_id = $1
        ORDER BY user_id, test_date DESC
      ) AS latest_assessments
      WHERE risk_status = 'At Risk'
    `, [schoolId]);

    res.json({
      success: true,
      total_players: Number(playersRes.rows[0]?.count || 0),
      avg_score: Math.round(stats.average_score || 0),
      at_risk: Number(atRiskRes.rows[0]?.count || 0)
    });

  } catch (error) {
    console.error('[dashboard] Error fetching dashboard data:', error.message);
    // Return safe defaults to prevent frontend crash
    res.json({
      success: true,
      total_players: 0,
      avg_score: 0,
      at_risk: 0
    });
  }
});

// 🔥 TREND (Explicitly filtered by school_id=1)
router.get('/trend', async (req, res) => {
  try {
    const schoolId = 1; // Default for demo context
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
    console.error('[trend] Error fetching trend data:', error.message);
    // CRITICAL: Return empty array to prevent data.map crash on frontend
    res.json({
      success: true,
      data: []
    });
  }
});

module.exports = router;
