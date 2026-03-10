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
  ssl: {
    rejectUnauthorized: false
  }
});

/* ============================
   LOGIN
============================ */

app.post("/api/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    const result = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: "Invalid login credentials" });
    }

    const user = result.rows[0];

    if (password !== user.password) {
      return res.status(401).json({ error: "Invalid login credentials" });
    }

    const token = jwt.sign(
      { id: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "24h" }
    );

    res.json({ token });

  } catch (err) {

    console.error("LOGIN ERROR:", err);

    res.status(500).json({
      error: "Internal Server Error"
    });
  }
});

/* ============================
   AUTH MIDDLEWARE
============================ */

function authenticate(req, res, next) {

  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ error: "Missing token" });
  }

  const token = authHeader.split(" ")[1];

  try {

    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET
    );

    req.user = decoded;

    next();

  } catch (err) {

    return res.status(401).json({
      error: "Invalid token"
    });
  }
}

/* ============================
   GET PLAYERS
============================ */

app.get("/api/players", authenticate, async (req, res) => {

  try {

    const result = await pool.query(
      "SELECT * FROM players ORDER BY id DESC"
    );

    res.json(result.rows);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to fetch players"
    });
  }
});

/* ============================
   ADD PLAYER
============================ */

app.post("/api/players", authenticate, async (req, res) => {

  try {

    const { name, gender, dob } = req.body;

    const result = await pool.query(
      `INSERT INTO players (name, gender, dob)
       VALUES ($1,$2,$3)
       RETURNING *`,
      [name, gender, dob]
    );

    res.json(result.rows[0]);

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to add player"
    });
  }
});

/* ============================
   ADD ASSESSMENT
============================ */

app.post("/api/assessments", authenticate, async (req, res) => {

  try {

    const {
      user_id,
      physical_score,
      mental_score,
      skill_score,
      overall_score,
      improvement_pct
    } = req.body;

    const result = await pool.query(
      `INSERT INTO assessment_sessions
      (user_id, physical_score, mental_score, skill_score, overall_score, improvement_pct)
      VALUES ($1,$2,$3,$4,$5,$6)
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

  } catch (err) {

    console.error(err);

    res.status(500).json({
      error: "Failed to save assessment"
    });
  }
});

/* ============================
   SERVER START
============================ */

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {

  console.log("Sportz-Well backend running on port", PORT);

});