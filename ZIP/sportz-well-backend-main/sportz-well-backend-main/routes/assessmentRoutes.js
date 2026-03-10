const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

/*
SAVE ASSESSMENT
*/
router.post("/assessment/save", authMiddleware, async (req, res) => {
  try {

    const {
      user_id,
      quarter,
      physical,
      skill,
      mental,
      coach
    } = req.body;

    // Convert to integers
    const physicalScore = parseInt(physical);
    const skillScore = parseInt(skill);
    const mentalScore = parseInt(mental);
    const coachScore = parseInt(coach);

    // VALIDATION (0-100)
    const scores = [physicalScore, skillScore, mentalScore, coachScore];

    for (let s of scores) {
      if (isNaN(s) || s < 0 || s > 100) {
        return res.status(400).json({
          error: "Scores must be between 0 and 100"
        });
      }
    }

    const overall =
      Math.round(
        (physicalScore + skillScore + mentalScore + coachScore) / 4
      );

    const query = `
      INSERT INTO assessment_sessions
      (user_id, school_id, physical_score, skill_score, mental_score, coach_score, overall_score, quarterly_cycle, test_date)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,CURRENT_DATE)
    `;

    await pool.query(query, [
      user_id,
      req.user.school_id,
      physicalScore,
      skillScore,
      mentalScore,
      coachScore,
      overall,
      quarter
    ]);

    res.json({ message: "Assessment Saved Successfully" });

  } catch (err) {

    console.error("Assessment save error:", err);

    res.status(500).json({
      error: "Save failed"
    });
  }
});

module.exports = router;