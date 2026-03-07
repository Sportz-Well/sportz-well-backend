const express = require("express");
const router = express.Router();

const pool = require("../db");
const authMiddleware = require("../middleware/authMiddleware");


/*
GET ALL PLAYERS
*/
router.get("/players", authMiddleware, async (req, res) => {

try {

const schoolId = req.user.school_id;

const result = await pool.query(`
SELECT
p.id,
p.name,
p.age,
p.role,
COALESCE(a.overall_score,0) AS latest_score,
COALESCE(a.improvement_pct,0) AS improvement_pct
FROM players p
LEFT JOIN LATERAL (
SELECT overall_score, improvement_pct
FROM assessment_sessions
WHERE user_id = p.id
ORDER BY test_date DESC
LIMIT 1
) a ON true
WHERE p.school_id = $1
ORDER BY p.name
`, [schoolId]);

res.json(result.rows);

} catch(err) {

console.error(err);
res.status(500).json({error:"Server error"});

}

});



/*
GET SINGLE PLAYER PROFILE
*/
router.get("/player/:id", authMiddleware, async (req,res)=>{

try{

const playerId = req.params.id;

const player = await pool.query(`
SELECT id,name,age,role
FROM players
WHERE id=$1
`,[playerId]);

const trend = await pool.query(`
SELECT quarterly_cycle AS quarter,
overall_score AS score
FROM assessment_sessions
WHERE user_id=$1
ORDER BY quarterly_cycle
`,[playerId]);

res.json({
age:player.rows[0].age,
role:player.rows[0].role,
trend:trend.rows
});

}catch(err){

console.error(err);
res.status(500).json({error:"Player fetch failed"});

}

});


/*
ADD PLAYER
*/
router.post("/players", authMiddleware, async (req,res)=>{

try{

const {name,age,role,gender}=req.body;

const schoolId=req.user.school_id;

await pool.query(`
INSERT INTO players (name,age,role,gender,school_id)
VALUES ($1,$2,$3,$4,$5)
`,
[name,age,role,gender,schoolId]);

res.json({message:"Player added"});

}catch(err){

console.error(err);
res.status(500).json({error:"Add player failed"});

}

});


module.exports = router;