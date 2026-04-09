'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');

router.post('/reset', async (req, res) => {
    try {
        // 1. Clear existing demo data for the pitch
        await pool.query('DELETE FROM players WHERE school_id = 1');

        // 2. Insert exactly 10 players (3 At Risk, 7 Stable/Optimal)
        const dummyPlayers = [
            // Boys
            { name: 'Aarav Sharma', age: 13, dob: '2012-05-15', gender: 'Male', role: 'Batsman', score: 8.5, signal: 'Optimal' },
            { name: 'Rohan Desai', age: 14, dob: '2011-08-22', gender: 'Male', role: 'Pace Bowler', score: 4.2, signal: 'At Risk' }, // Risk 1
            { name: 'Kabir Singh', age: 16, dob: '2009-11-10', gender: 'Male', role: 'All-Rounder', score: 6.8, signal: 'Stable' },
            { name: 'Vivaan Kapoor', age: 13, dob: '2012-02-28', gender: 'Male', role: 'Wicket Keeper', score: 7.5, signal: 'Optimal' },
            { name: 'Aryan Patel', age: 15, dob: '2010-07-04', gender: 'Male', role: 'Spin Bowler', score: 3.8, signal: 'At Risk' }, // Risk 2
            
            // Girls
            { name: 'Manjiri Wadke', age: 14, dob: '2011-09-12', gender: 'Female', role: 'Top Order Batter', score: 7.2, signal: 'Stable' },
            { name: 'Sara Gupte', age: 15, dob: '2010-03-18', gender: 'Female', role: 'Spinner', score: 4.5, signal: 'At Risk' }, // Risk 3
            { name: 'Priya Iyer', age: 13, dob: '2012-12-05', gender: 'Female', role: 'All-Rounder', score: 8.1, signal: 'Optimal' },
            { name: 'Neha Reddy', age: 16, dob: '2009-04-25', gender: 'Female', role: 'Pace Bowler', score: 6.5, signal: 'Stable' },
            { name: 'Ananya Sharma', age: 14, dob: '2011-01-30', gender: 'Female', role: 'Wicket Keeper', score: 7.8, signal: 'Optimal' }
        ];

        for (let p of dummyPlayers) {
            await pool.query(
                `INSERT INTO players (school_id, name, age, date_of_birth, gender, role, latest_score, coach_signal, std, div)
                 VALUES (1, $1, $2, $3, $4, $5, $6, $7, '8', 'A')`,
                [p.name, p.age, p.dob, p.gender, p.role, p.score, p.signal]
            );
        }

        res.json({ success: true, message: 'Reset to 10 players successfully.' });
    } catch (error) {
        console.error('Demo Reset Error:', error);
        res.status(500).json({ error: 'Failed to reset demo data', details: error.message });
    }
});

module.exports = router;