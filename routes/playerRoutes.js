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
    school: "Don Bosco",
    aadhaar: "1234",
    standard: "9th",
    division: "A"
  },
  {
    id: 2,
    name: "Riya Mehta",
    age: 13,
    gender: "Female",
    role: "All-Rounder",
    school: "DAV",
    aadhaar: "5678",
    standard: "8th",
    division: "B"
  }
];

router.get('/', (req, res) => {
  res.json({ success: true, data: players });
});

router.get('/:id', (req, res) => {
  const player = players.find(p => p.id == req.params.id);
  res.json({ success: true, data: player });
});

router.post('/', (req, res) => {
  res.json({ success: true, message: "Player added" });
});

module.exports = router;