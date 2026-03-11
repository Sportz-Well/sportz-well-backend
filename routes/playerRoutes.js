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

try {

const playerColsResult = await pool.query(`
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'players'
`);

const assessmentColsResult = await pool.query(`
SELECT column_name
FROM information_schema.columns
WHERE table_name = 'assessment_sessions'
`);

const playerCols = new Set(playerColsResult.rows.map((r)=>r.column_name));
const assessmentCols = new Set(assessmentColsResult.rows.map((r)=>r.column_name));

const dobSelect = playerCols.has("dob")
? "p.dob"
: (playerCols.has("date_of_birth") ? "p.date_of_birth AS dob" : "NULL::date AS dob");
const genderSelect = playerCols.has("gender") ? "p.gender" : "NULL::text AS gender";
const roleSelect = playerCols.has("role") ? "p.role" : "NULL::text AS role";

const joinColumn = assessmentCols.has("user_id")
? "user_id"
: (assessmentCols.has("player_id") ? "player_id" : null);

const orderColumn = ["created_at","assessment_date","recorded_at","date","test_date"]
.find((col)=>assessmentCols.has(col)) || null;

const overallSelect = assessmentCols.has("overall_score")
? "overall_score"
: "NULL::integer AS overall_score";
const improvementSelect = assessmentCols.has("improvement_pct")
? "improvement_pct"
: "NULL::integer AS improvement_pct";

const lateralQuery = joinColumn ? `
SELECT ${overallSelect}, ${improvementSelect}
FROM assessment_sessions
WHERE ${joinColumn} = p.id
${orderColumn ? `ORDER BY ${orderColumn} DESC` : ""}
LIMIT 1
` : `
SELECT NULL::integer AS overall_score, NULL::integer AS improvement_pct
`;

const query = `
SELECT
p.id,
p.name,
${dobSelect},
${genderSelect},
${roleSelect},
a.overall_score,
a.improvement_pct
FROM players p
LEFT JOIN LATERAL (
    ${lateralQuery}
) a ON true
WHERE p.id = $1;
`;

const result = await pool.query(query,[req.params.id]);

if(result.rows.length === 0){
return res.status(404).json({error:"Player not found"});
}

res.json(result.rows[0]);

} catch(err) {
console.error("Player profile query failed:", err);
res.status(500).json({error:"Server error loading player profile"});
}

});

/*
GET PLAYER PROGRESS TREND
*/
router.get("/player/:id/progress", authMiddleware, async (req,res)=>{

try{

const result = await pool.query(`
SELECT
overall_score,
improvement_pct,
created_at
FROM assessment_sessions
WHERE user_id = $1
ORDER BY created_at ASC
LIMIT 8
`, [req.params.id]);

res.json(result.rows);

}catch(err){

console.error("Player progress query failed:", err);
res.status(500).json({error:"Player progress fetch failed"});

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
