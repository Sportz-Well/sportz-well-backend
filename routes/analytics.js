'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const AnalyticsService = require('../analyticsService');
const { authenticate } = require('../middleware/authMiddleware'); // FIXED: destructured import

const analyticsService = new AnalyticsService(db);

// ==========================================================
// ALL ROUTES PROTECTED — authenticate runs on every call
// ==========================================================

// TEST ROUTE (Protected — internal use only)
router.get('/test', authenticate, (req, res) => {
  res.json({ message: 'NEW CODE DEPLOYED SUCCESSFULLY' });
});

// DASHBOARD — filtered by the logged-in coach's academy
router.get('/dashboard', authenticate, async (req, res) => {
  try {
    // FIXED: Use the academy from the verified JWT token, not a hardcoded value
    const secureAcademyId = req.user.academy_id;

    const stats = await analyticsService.getDashboardAnalytics(secureAcademyId);

    const playersRes = await db.query(
      'SELECT COUNT(*) as count FROM players WHERE academy_id = $1',
      [secureAcademyId]
    );

    const atRiskRes = await db.query(`
      SELECT COUNT(*) as count 
      FROM (
        SELECT DISTINCT ON (user_id) risk_status
        FROM assessment_sessions
        WHERE school_id = $1
        ORDER BY user_id, test_date DESC
      ) AS latest_assessments
      WHERE risk_status = 'At Risk'
    `, [secureAcademyId]);

    res.json({
      success: true,
      total_players: Number(playersRes.rows[0]?.count || 0),
      avg_score: Math.round(stats.average_score || 0),
      at_risk: Number(atRiskRes.rows[0]?.count || 0)
    });

  } catch (error) {
    console.error('[dashboard] Error fetching dashboard data:', error.message);
    res.json({ success: true, total_players: 0, avg_score: 0, at_risk: 0 });
  }
});

// TREND — filtered by the logged-in coach's academy
router.get('/trend', authenticate, async (req, res) => {
  try {
    const secureAcademyId = req.user.academy_id;
    const trendData = await analyticsService.getSchoolTrend(secureAcademyId);

    if (!trendData || !Array.isArray(trendData)) {
      return res.json({ success: true, data: [] });
    }

    res.json({
      success: true,
      data: trendData.map(row => ({
        label: row.test_date
          ? new Date(row.test_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          : 'N/A',
        avg_score: Math.round(row.avg_score || 0)
      }))
    });

  } catch (error) {
    console.error('[trend] Error fetching trend data:', error.message);
    res.json({ success: true, data: [] });
  }
});

// PLAYER TREND — verify player belongs to the coach's academy before returning data
router.get('/players/:id/trend', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const secureAcademyId = req.user.academy_id;

    // Security check: confirm this player belongs to the logged-in coach's academy
    const playerCheck = await db.query(
      'SELECT id FROM players WHERE id = $1 AND academy_id = $2',
      [id, secureAcademyId]
    );

    if (playerCheck.rows.length === 0) {
      return res.status(403).json({ success: false, error: 'Access denied or player not found.' });
    }

    const trendData = await analyticsService.getPlayerTrend(id);

    res.json({
      success: true,
      data: trendData.map(row => ({
        label: row.quarterly_cycle || (row.test_date
          ? new Date(row.test_date).toLocaleDateString('en-GB', { month: 'short', year: '2-digit' })
          : 'N/A'),
        avg_score: Math.round(row.score || 0)
      }))
    });

  } catch (error) {
    console.error(`[player-trend] Error for player ${req.params.id}:`, error.message);
    res.json({ success: true, data: [] });
  }
});

module.exports = router;
