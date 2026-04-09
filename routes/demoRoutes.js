'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/reset', async (req, res) => {
    try {
        await pool.query('DELETE FROM players WHERE school_id = 1');

        // EXACTLY 10 PLAYERS
        const dummyPlayers = [
            { name: 'Vihaan Shah', age: 10, dob: '2016-04-12', gender: 'Male', role: 'Batsman', score: 8.5, signal: 'Optimal' },
            { name: 'Rohan Desai', age: 12, dob: '2014-08-22', gender: 'Male', role: 'Pace Bowler', score: 4.2, signal: 'At Risk' },
            { name: 'Kabir Singh', age: 13, dob: '2013-11-10', gender: 'Male', role: 'All-Rounder', score: 6.8, signal: 'Stable' },
            { name: 'Aryan Patel', age: 10, dob: '2016-07-04', gender: 'Male', role: 'Spin Bowler', score: 3.8, signal: 'At Risk' },
            { name: 'Dhruv Joshi', age: 12, dob: '2014-02-28', gender: 'Male', role: 'Wicket Keeper', score: 7.5, signal: 'Optimal' },
            { name: 'Manjiri Wadke', age: 13, dob: '2013-09-12', gender: 'Female', role: 'Top Order Batter', score: 7.2, signal: 'Stable' },
            { name: 'Sara Gupte', age: 12, dob: '2014-03-18', gender: 'Female', role: 'Spinner', score: 4.5, signal: 'At Risk' },
            { name: 'Priya Iyer', age: 10, dob: '2016-12-05', gender: 'Female', role: 'All-Rounder', score: 8.1, signal: 'Optimal' },
            { name: 'Neha Reddy', age: 13, dob: '2013-04-25', gender: 'Female', role: 'Pace Bowler', score: 6.5, signal: 'Stable' },
            { name: 'Ananya Sharma', age: 12, dob: '2014-01-30', gender: 'Female', role: 'Wicket Keeper', score: 7.8, signal: 'Optimal' }
        ];

        for (let p of dummyPlayers) {
            await pool.query(
                `INSERT INTO players (school_id, name, age, date_of_birth, gender, role, latest_score, coach_signal, std, div, school_id_no, aadhaar_card_no)
                 VALUES (1, $1, $2, $3, $4, $5, $6, $7, '8', 'A', 'SID-000', '0000-0000-0000')`,
                [p.name, p.age, p.dob, p.gender, p.role, p.score, p.signal]
            );
        }

        res.json({ success: true, message: 'Reset to 10 players successfully.' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to reset demo data', details: error.message });
    }
});

module.exports = router;