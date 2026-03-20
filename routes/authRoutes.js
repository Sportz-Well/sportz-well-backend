const express = require("express");
const router = express.Router();
const pool = require("../db");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");

router.post("/login", async (req, res) => {
  try {

    const { email, password } = req.body;

    const user = await pool.query(
      "SELECT * FROM users WHERE email=$1",
      [email]
    );

    if (user.rows.length === 0) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const dbUser = user.rows[0];

    try {
      const isMatch = dbUser.password ? await bcrypt.compare(password, dbUser.password) : false;
      if (!isMatch) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
    } catch (err) {
      console.error("[authRoutes] comparison error:", err.message);
      return res.status(401).json({ error: "Authentication failed" });
    }

    const token = jwt.sign(
      {
        id: dbUser.id,
        school_id: dbUser.school_id
      },
      process.env.JWT_SECRET
    );

    res.json({
      token
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

module.exports = router;