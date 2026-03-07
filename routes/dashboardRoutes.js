const express = require("express");
const router = express.Router();
const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");

/* DASHBOARD DATA */

router.get("/dashboard", authMiddleware, async (req, res) => {

try {

const result = await pool.query(`
SELECT
AVG(overall_score) as latest_score,
COUNT(CASE WHEN overall_score < 60 THEN 1 END) as at_risk
FROM assessment_sessions
`);

const topImprover = await pool.query(`
SELECT p.name
FROM players p
JOIN assessment_sessions a ON a.user_id = p.id
ORDER BY a.overall_score DESC
LIMIT 1
`);

res.json({
latestScore: parseFloat(result.rows[0].latest_score || 0).toFixed(2),
atRisk: parseInt(result.rows[0].at_risk || 0),
topImprover: topImprover.rows[0]?.name || "--",
avgImprove: 5
});

} catch (err) {

console.error(err);
res.status(500).json({ error: "Server error" });

}

});

module.exports = router;