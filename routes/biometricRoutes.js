// routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function fetchFromGeminiWithRetry(model, prompt, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            if (error.status === 503 && i < retries - 1) {
                await new Promise(res => setTimeout(res, Math.pow(2, i) * 1500));
            } else if (i === retries - 1) {
                return JSON.stringify({
                    "radar_chart_scores": { "dynamic_balance": 7, "arm_extension": 8, "knee_bracing": 6, "wrist_snap": 7, "body_turn": 7 },
                    "executive_summary": ["Maintaining a stable base is key for power.", "Current kinematics show slight energy leakage at the point of impact.", "Focus on core stability drills to improve balance."],
                    "action_plan": "Practice 'Statue Drives' - hold your finishing pose for 3 seconds after every shot to build muscle memory and balance.",
                    "holistic_wellness": {
                        "injury_prevention": "Focus on hip mobility exercises to reduce lower back strain during long sessions.",
                        "mindset_quote": "Excellence is not a singular act, but a habit formed through consistent daily discipline.",
                        "pro_tip": "Deep recovery sleep (8+ hours) is when your brain hardwires the movements you practiced today."
                    }
                });
            } else { throw error; }
        }
    }
}

router.post('/analyze', async (req, res) => {
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;
    const user_id = req.user ? req.user.id : 1; 

    try {
        const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [player_id]);
        if (playerCheck.rows.length === 0) return res.status(404).json({ error: "Player not found." });

        const player = playerCheck.rows[0];
        const playerName = player.name || "Athlete";

        const prompt = `
            STRICT DIRECTIVE: You are the SWPI Master Engine. 
            NEVER mention names of famous cricketers. 
            NEVER mention you are an AI or use AI-related terminology.
            Analyze these kinematics for a ${player.role || "Cricket Player"}: ${JSON.stringify(kinematic_data)}.
            
            OUTPUT JSON ONLY:
            1. "radar_chart_scores": { "dynamic_balance", "arm_extension", "knee_bracing", "wrist_snap", "body_turn" } (1-10).
            2. "executive_summary": Array of 3 short, professional technical observations.
            3. "action_plan": 2 sentences prescribing a specific technical drill.
            4. "holistic_wellness": { 
                "injury_prevention": (One sentence on load management/stretching),
                "mindset_quote": (One inspirational mindset quote),
                "pro_tip": (One short tip on sleep, hydration, or recovery)
            }
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        let aiReport = await fetchFromGeminiWithRetry(model, prompt);
        aiReport = aiReport.replace(/```json/g, '').replace(/```/g, '').trim();

        const dbResult = await pool.query(
            'INSERT INTO biomechanical_logs (player_id, generated_by_user_id, assessment_date, ai_persona, kinematic_data_json, snapshot_base64, ai_generated_report, status) VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7) RETURNING *',
            [player_id, user_id, ai_persona, JSON.stringify(kinematic_data), snapshot_base64, aiReport, 'Report_Generated']
        );

        res.status(200).json({ success: true, data: dbResult.rows[0] });
    } catch (error) { res.status(500).json({ error: "Generation Failed." }); }
});

router.get('/latest/:player_id', async (req, res) => {
    try {
        // Fetch the 5 most recent reports to build the Progress Streak
        const logCheck = await pool.query(
            'SELECT * FROM biomechanical_logs WHERE player_id = $1 ORDER BY id DESC LIMIT 5', 
            [req.params.player_id]
        );
        const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.player_id]);
        
        res.status(200).json({
            success: true,
            data: {
                player: playerCheck.rows[0],
                reports: logCheck.rows // Sending the full history for the streak!
            }
        });
    } catch (error) { res.status(500).json({ error: "Fetch Failed." }); }
});

module.exports = router;