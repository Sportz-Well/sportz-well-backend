const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

/* DASHBOARD DATA */

router.get("/dashboard", authMiddleware, async (req, res) => {

try {
const schoolId = req.user?.school_id;
if (!schoolId) {
  return res.status(403).json({ error: "Unauthorized: No school assigned" });
}

const result = await pool.query(`
SELECT
AVG(overall_score) as latest_score,
COUNT(CASE WHEN overall_score < 60 THEN 1 END) as at_risk,
AVG(improvement_pct) as avg_improve
FROM assessment_sessions
WHERE school_id = $1
`, [schoolId]);

const topImprover = await pool.query(`
SELECT p.name
FROM players p
JOIN assessment_sessions a ON a.user_id = p.id
WHERE p.school_id = $1
ORDER BY a.overall_score DESC
LIMIT 1
`, [schoolId]);

res.json({
latestScore: parseFloat(result.rows[0].latest_score || 0).toFixed(2),
atRisk: parseInt(result.rows[0].at_risk || 0),
topImprover: topImprover.rows[0]?.name || "--",
avgImprove: Number(result.rows[0].avg_improve || 0)
});

} catch (err) {

console.error(err);
res.status(500).json({ error: "Server error" });

}

});

module.exports = router;