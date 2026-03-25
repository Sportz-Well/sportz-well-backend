'use strict';

class AnalyticsService {
  constructor(db) {
    if (!db) {
      throw new Error('Database client is required');
    }

    this.db = db;
  }

  async getDashboardAnalytics(schoolId) {
    const query = `
      SELECT 
        AVG(overall_score) AS average_score
      FROM assessment_sessions
      WHERE school_id = $1
    `;

    const result = await this.db.query(query, [schoolId]);

    return {
      average_score: Number(result.rows[0]?.average_score || 0)
    };
  }

  async getSchoolTrend(schoolId) {
    const query = `
      SELECT 
        test_date,
        AVG(overall_score) as avg_score
      FROM assessment_sessions
      WHERE school_id = $1
      GROUP BY test_date
      ORDER BY test_date ASC
    `;

    const result = await this.db.query(query, [schoolId]);

    return result.rows;
  }

  async getPlayerTrend(playerId) {
    const query = `
      SELECT 
        test_date,
        overall_score as score,
        quarterly_cycle
      FROM assessment_sessions
      WHERE user_id = $1
      ORDER BY test_date ASC
    `;

    const result = await this.db.query(query, [playerId]);
    return result.rows;
  }
}

module.exports = AnalyticsService;