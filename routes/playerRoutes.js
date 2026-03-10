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

const result = await pool.query(`
SELECT
p.name,
p.gender,
p.dob,
a.overall_score,
a.improvement_pct
FROM players p
LEFT JOIN assessment_sessions a
ON p.id = a.user_id
WHERE p.id = $1
ORDER BY a.created_at DESC
LIMIT 1
`,[playerId]);

if(result.rows.length===0){
return res.status(404).json({error:"Player not found"});
}

res.json(result.rows[0]);

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
