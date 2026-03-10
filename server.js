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

/* ============================
   CREATE ADMIN IF NOT EXISTS
============================ */

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

    console.log("Admin user created automatically");

  } else {

    console.log("Admin user already exists");

  }

}

/* ============================
   LOGIN
============================ */

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

/* ============================
   START SERVER
============================ */

const PORT = process.env.PORT || 10000;

app.listen(PORT, async ()=>{

  console.log("Server running on port",PORT);

  await ensureAdmin();

});