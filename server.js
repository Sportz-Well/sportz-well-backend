require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");
const playerRoutes = require("./routes/playerRoutes");

const app = express();

app.use(cors());
app.use(express.json());

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

/* ===============================
   CREATE TABLES IF NOT EXIST
================================ */

async function setupDatabase() {

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS players (
      id SERIAL PRIMARY KEY,
      name TEXT,
      gender TEXT,
      dob DATE
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS assessment_sessions (
      id SERIAL PRIMARY KEY,
      user_id INTEGER,
      physical_score INTEGER,
      mental_score INTEGER,
      skill_score INTEGER,
      overall_score INTEGER,
      improvement_pct INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  console.log("Tables ready");

}

/* ===============================
   CREATE ADMIN USER
================================ */

async function ensureAdmin() {

  const result = await pool.query(
    "SELECT * FROM users WHERE email=$1",
    ["admin@sportzwell.com"]
  );

  if (result.rows.length === 0) {

    await pool.query(
      `INSERT INTO users (email,password,role)
       VALUES ($1,$2,$3)`,
      ["admin@sportzwell.com","admin123","admin"]
    );

    console.log("Admin created");

  } else {

    console.log("Admin already exists");

  }

}

/* ===============================
   LOGIN
================================ */

app.post("/api/login", async (req,res)=>{

  try{

    const {email,password}=req.body;

    const result=await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if(result.rows.length===0){
      return res.status(401).json({error:"Invalid login credentials"});
    }

    const user=result.rows[0];

    if(password!==user.password){
      return res.status(401).json({error:"Invalid login credentials"});
    }

    const token=jwt.sign(
      {id:user.id,role:user.role},
      process.env.JWT_SECRET,
      {expiresIn:"24h"}
    );

    res.json({token});

  }catch(err){

    console.error(err);

    res.status(500).json({error:"Internal Server Error"});

  }

});

/* ===============================
   AUTH MIDDLEWARE
================================ */

function authenticate(req,res,next){

  const auth=req.headers.authorization;

  if(!auth){
    return res.status(401).json({error:"Missing token"});
  }

  const token=auth.split(" ")[1];

  try{

    const decoded=jwt.verify(token,process.env.JWT_SECRET);

    req.user=decoded;

    next();

  }catch(err){

    return res.status(401).json({error:"Invalid token"});

  }

}

/* ===============================
   GET PLAYERS
================================ */

app.get("/api/players",authenticate,async(req,res)=>{

  const result=await pool.query(
    "SELECT * FROM players ORDER BY id DESC"
  );

  res.json(result.rows);

});

/* ===============================
   ADD PLAYER
================================ */

app.post("/api/players",authenticate,async(req,res)=>{

  const {name,gender,dob}=req.body;

  const result=await pool.query(
    `INSERT INTO players(name,gender,dob)
     VALUES($1,$2,$3)
     RETURNING *`,
    [name,gender,dob]
  );

  res.json(result.rows[0]);

});

/* ===============================
   ADD ASSESSMENT
================================ */

app.post("/api/assessments",authenticate,async(req,res)=>{

  const {
    user_id,
    physical_score,
    mental_score,
    skill_score,
    overall_score,
    improvement_pct
  }=req.body;

  const result=await pool.query(
    `INSERT INTO assessment_sessions
     (user_id,physical_score,mental_score,skill_score,overall_score,improvement_pct)
     VALUES($1,$2,$3,$4,$5,$6)
     RETURNING *`,
    [
      user_id,
      physical_score,
      mental_score,
      skill_score,
      overall_score,
      improvement_pct
    ]
  );

  res.json(result.rows[0]);

});

/* ===============================
   DASHBOARD METRICS
================================ */

app.get("/api/dashboard",authenticate,async(req,res)=>{

  try{

    const latestScoreResult = await pool.query(
      `SELECT overall_score
       FROM assessment_sessions
       ORDER BY created_at DESC, id DESC
       LIMIT 1`
    );

    const quarterGrowthResult = await pool.query(
      `WITH quarter_averages AS (
         SELECT date_trunc('quarter', created_at) AS quarter_start,
                AVG(overall_score)::numeric AS avg_score
         FROM assessment_sessions
         GROUP BY 1
       ), ranked AS (
         SELECT quarter_start,
                avg_score,
                LAG(avg_score) OVER (ORDER BY quarter_start) AS prev_avg
         FROM quarter_averages
       )
       SELECT avg_score, prev_avg
       FROM ranked
       ORDER BY quarter_start DESC
       LIMIT 1`
    );

    const topImproverResult = await pool.query(
      `SELECT user_id,
              AVG(improvement_pct)::numeric AS avg_improvement
       FROM assessment_sessions
       WHERE user_id IS NOT NULL
       GROUP BY user_id
       ORDER BY avg_improvement DESC NULLS LAST
       LIMIT 1`
    );

    const atRiskResult = await pool.query(
      `WITH latest_per_user AS (
         SELECT DISTINCT ON (user_id) user_id, overall_score
         FROM assessment_sessions
         WHERE user_id IS NOT NULL
         ORDER BY user_id, created_at DESC, id DESC
       )
       SELECT COUNT(*)::int AS at_risk_count
       FROM latest_per_user
       WHERE overall_score < 60`
    );

    const avgImprovementResult = await pool.query(
      `SELECT COALESCE(ROUND(AVG(improvement_pct)::numeric,2),0) AS avg_improvement
       FROM assessment_sessions`
    );

    const latest_score = latestScoreResult.rows[0]?.overall_score ?? 0;

    const currentQuarterAvg = quarterGrowthResult.rows[0]?.avg_score;
    const previousQuarterAvg = quarterGrowthResult.rows[0]?.prev_avg;

    const quarter_growth = (currentQuarterAvg !== null && currentQuarterAvg !== undefined && previousQuarterAvg !== null && previousQuarterAvg !== undefined)
      ? Number((Number(currentQuarterAvg) - Number(previousQuarterAvg)).toFixed(2))
      : 0;

    const top_improver = topImproverResult.rows[0]?.user_id ?? null;
    const at_risk_count = atRiskResult.rows[0]?.at_risk_count ?? 0;
    const avg_improvement = Number(avgImprovementResult.rows[0]?.avg_improvement ?? 0);

    res.json({
      latest_score,
      quarter_growth,
      top_improver,
      at_risk_count,
      avg_improvement
    });

  }catch(err){

    console.error(err);
    res.status(500).json({error:"Dashboard metrics failed"});

  }

});
app.use("/api", playerRoutes);

/* ===============================
   START SERVER
================================ */

const PORT = process.env.PORT || 10000;

app.listen(PORT, async ()=>{

  console.log("Server running on port",PORT);

  await setupDatabase();

  await ensureAdmin();

});




