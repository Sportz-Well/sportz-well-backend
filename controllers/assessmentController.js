const pool = require("../db");

// =======================================
// GET PLAYERS FOR ASSESSMENT
// =======================================

exports.getPlayersForAssessment = async (req, res) => {
  try {
    const schoolId = "40118e73-d45e-4ea-b93d-ec9778c94ff4";
    const result = await pool.query(
      `
      SELECT id, name
      FROM players
      WHERE school_id = $1
      ORDER BY name
      `,
      [schoolId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Players Fetch Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};

// =======================================
// SAVE QUARTERLY ASSESSMENT
// =======================================

exports.saveAssessment = async (req, res) => {
  try {
    const { assessments, quarter } = req.body;
    const schoolId = "40118e73-d45e-4ea-b93d-ec9778c94ff4";

    for (let a of assessments) {
      const overall = (Number(a.physical) + Number(a.skill) + Number(a.mental) + Number(a.coach)) / 4;

      // 1. Save to the historical assessment log
      await pool.query(
        `
        INSERT INTO assessment_sessions
        (user_id, school_id, physical_score, skill_score, mental_score, coach_score, overall_score, quarterly_cycle)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
        `,
        [a.playerId, schoolId, a.physical, a.skill, a.mental, a.coach, overall, quarter]
      );

      // 2. THE NEW WIRE: Calculate the Risk Signal
      let signal = 'Stable';
      if (overall >= 75) signal = 'Optimal';
      else if (overall < 50) signal = 'At Risk';

      // 3. Update the Master Player Table (This drives the Dashboard and Profile!)
      // Note: Make sure your column name matches your database (e.g., coach_signal or risk_signal)
      await pool.query(
        `
        UPDATE players
        SET latest_score = $1, coach_signal = $2
        WHERE id = $3
        `,
        [overall.toFixed(1), signal, a.playerId]
      );
    }

    res.json({ success: true });

  } catch (err) {
    console.error("Assessment Save Error:", err);
    res.status(500).json({ error: "Server error" });
  }
};