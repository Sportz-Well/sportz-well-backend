require("dotenv").config();

const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

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
   START SERVER
================================ */

const PORT = process.env.PORT || 10000;

app.listen(PORT, async ()=>{

  console.log("Server running on port",PORT);

  await setupDatabase();

  await ensureAdmin();

});