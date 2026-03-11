require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
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
    ALTER TABLE players
    ADD COLUMN IF NOT EXISTS role TEXT
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

  await pool.query(`
    ALTER TABLE assessment_sessions
    ADD COLUMN IF NOT EXISTS user_id INTEGER,
    ADD COLUMN IF NOT EXISTS overall_score INTEGER,
    ADD COLUMN IF NOT EXISTS improvement_pct INTEGER,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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
   CREATE DEMO COACH USER
================================ */

async function ensureCoachDemoUser() {

  const coachEmail = "coach@sportzwell.com";
  const existing = await pool.query(
    "SELECT id FROM users WHERE email=$1",
    [coachEmail]
  );

  if(existing.rows.length > 0){
    console.log("Coach demo user already exists");
    return;
  }

  const hashedPassword = await bcrypt.hash("demo123",10);

  const userColsResult = await pool.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_name = 'users'`
  );
  const userCols = new Set(userColsResult.rows.map((r)=>r.column_name));

  if(userCols.has("role")){
    await pool.query(
      `INSERT INTO users(email,password,role)
       VALUES($1,$2,$3)`,
      [coachEmail,hashedPassword,"coach"]
    );
  }else{
    await pool.query(
      `INSERT INTO users(email,password)
       VALUES($1,$2)`,
      [coachEmail,hashedPassword]
    );
  }

  console.log("Coach demo user created");

}

/* ===============================
   SEED DEMO DATA (RUN ONCE)
================================ */

async function seedCoachDemoDataOnce(forceReset = false) {

  const seedKey = "coach_demo_seed_v1";

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_flags (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const existingSeed = await pool.query(
    `SELECT value FROM app_flags WHERE key = $1`,
    [seedKey]
  );

  if(!forceReset && existingSeed.rows.length > 0){
    console.log("Coach demo seed already applied");
    return;
  }

  const client = await pool.connect();

  try{

    await client.query("BEGIN");

    await client.query("DELETE FROM assessment_sessions");
    await client.query("DELETE FROM players");

    const playersResult = await client.query(`
      INSERT INTO players(name,dob,gender,role) VALUES
      ('Aarav Jagdale','2008-06-17','Male','Batsman'),
      ('Vedant Kulkarni','2009-03-12','Male','Bowler'),
      ('Rohan Patil','2008-11-02','Male','All-Rounder'),
      ('Aryan Deshmukh','2009-01-21','Male','Wicketkeeper'),
      ('Sarthak More','2008-07-09','Male','Bowler'),
      ('Mihir Jadhav','2009-05-18','Male','Batsman')
      RETURNING id
    `);

    const scoreRows = [
      { overall: 87, improvement: 6 },
      { overall: 81, improvement: 4 },
      { overall: 74, improvement: 3 },
      { overall: 69, improvement: 2 },
      { overall: 41, improvement: -4 },
      { overall: 36, improvement: -6 }
    ];

    for(let i=0; i<playersResult.rows.length; i++){

      const playerId = playersResult.rows[i].id;
      const score = scoreRows[i];
      const createdAt = new Date(Date.now() - (scoreRows.length - i) * 60000);

      await client.query(
        `INSERT INTO assessment_sessions
         (user_id,physical_score,mental_score,skill_score,overall_score,improvement_pct,created_at)
         VALUES($1,$2,$3,$4,$5,$6,$7)`,
        [
          playerId,
          score.overall,
          score.overall,
          score.overall,
          score.overall,
          score.improvement,
          createdAt
        ]
      );

    }

    await client.query(
      `INSERT INTO app_flags(key,value)
       VALUES($1,$2)
       ON CONFLICT (key)
       DO UPDATE SET value = EXCLUDED.value,
                     updated_at = CURRENT_TIMESTAMP`,
      [seedKey,"done"]
    );

    await client.query("COMMIT");

    console.log("Coach demo seed applied");

  }catch(err){

    await client.query("ROLLBACK");
    throw err;

  }finally{

    client.release();

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

    let valid = false;

    if(user.password && user.password.startsWith("$2")){
      valid = await bcrypt.compare(password,user.password);
    }else{
      valid = password===user.password;
    }

    if(!valid){
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

  try{

    const query = `
      SELECT
      p.id,
      p.name,
      p.dob,
      p.role,
      a.overall_score,
      a.improvement_pct
      FROM players p
      LEFT JOIN LATERAL (
         SELECT overall_score, improvement_pct
         FROM assessment_sessions
         WHERE user_id = p.id
         ORDER BY created_at DESC
         LIMIT 1
      ) a ON true
      ORDER BY p.name;
    `;

    const result = await pool.query(query);

    res.json(result.rows);

  }catch(err){

    console.error("Players query failed:", err);
    res.status(500).json({error:"Server error while loading players"});

  }

});

/* ===============================
   ADD PLAYER
================================ */

app.post("/api/players",authenticate,async(req,res)=>{

  try{

    const {name,dob,gender,role}=req.body;

    const result=await pool.query(
      `INSERT INTO players(name,dob,gender,role)
       VALUES($1,$2,$3,$4)
       RETURNING *`,
      [name,dob,gender,role]
    );

    res.json(result.rows[0]);

  }catch(err){

    console.error("POST /api/players failed:", err);
    res.status(500).json({error:"Failed to add player"});

  }

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

/* ===============================
   RESET DEMO DATASET
================================ */

app.post("/api/reset-demo",authenticate,async(req,res)=>{

  try{

    await seedCoachDemoDataOnce(true);

    res.json({message:"Demo dataset reset complete"});

  }catch(err){

    console.error("Reset demo failed:", err);
    res.status(500).json({error:"Failed to reset demo dataset"});

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
  await ensureCoachDemoUser();

  await seedCoachDemoDataOnce();

});







