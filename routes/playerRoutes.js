'use strict';

const express = require('express');
const router = express.Router();

const players = [
  {
    id: 1,
    name: "Aarav Sharma",
    age: 14,
    gender: "Male",
    role: "Batsman",
    school_id: "SCH001",
    aadhaar_no: "1234",
    standard: "9",
    division: "A"
  },
  {
    id: 2,
    name: "Riya Mehta",
    age: 13,
    gender: "Female",
    role: "All-Rounder",
    school_id: "SCH002",
    aadhaar_no: "5678",
    standard: "8",
    division: "B"
  }
];

// 🔥 RETURN PURE ARRAY (CRITICAL FIX)
router.get('/', (req, res) => {
  res.json(players);
});

// 🔥 SINGLE PLAYER
router.get('/:id', (req, res) => {
  const player = players.find(p => p.id == req.params.id);
  res.json(player);
});

// 🔥 ADD PLAYER (mock)
router.post('/', (req, res) => {
  res.json({
    message: "Player added successfully"
  });
});

module.exports = router;