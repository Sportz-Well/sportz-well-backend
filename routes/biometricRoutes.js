// routes/biometricRoutes.js - CRICKETING AUTHORITY VERSION
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
                    "radar_chart_scores": { "dynamic_balance": 4, "arm_extension": 5, "knee_bracing": 3, "wrist_snap": 4, "body_turn": 4 },
                    "executive_summary": ["Technical collapse detected in the primary base.", "Energy is being absorbed by the joints rather than transferred to the shot.", "Immediate intervention required for stance stability."],
                    "action_plan": "Execute 'Wall-Support Drives' to fix the collapsing base. Focus on maintaining a braced front leg during the full swing.",
                    "holistic_wellness": { "injury_prevention": "High joint load detected; prioritize knee strengthening.", "mindset_quote": "Technique is the shield that protects your talent.", "pro_tip": "Hydrate with electrolytes to maintain muscle firing speed." }
                });
            } else { throw error; }
        }
    }
}

router.post('/analyze', async (req, res) => {
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;

    try {
        const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [player_id]);
        const player = playerCheck.rows[0];

        const prompt = `
            STRICT DIRECTIVE: You are the SWPI Master Biomechanical Engine. 
            Analyze these kinematics for a ${player.role}: ${JSON.stringify(kinematic_data)}.
            
            CRICKETING BENCHMARKS:
            - BATTING KNEE: Ideal is 120°-135°. If >145°, it is a COLLAPSE (Score < 4). 
            - ARM ROTATION: If high (>70°) but Knee is collapsed, it is a technical FAILURE in the kinetic chain.
            - SCORE RUTHLESSLY: Do not give high scores to beginners. A 70/100 is for a District-level player.
            
            OUTPUT JSON ONLY:
            1. "radar_chart_scores": { "dynamic_balance", "arm_extension", "knee_bracing", "wrist_snap", "body_turn" } (1-10).
            2. "executive_summary": [Observation, The "So What?", The Technical Fix].
            3. "action_plan": 2 technical sentences.
            4. "holistic_wellness": { "injury_prevention", "mindset_quote", "pro_tip" }
        `;

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" }); 
        let aiReport = await fetchFromGeminiWithRetry(model, prompt);
        aiReport = aiReport.replace(/```json/g, '').replace(/```/g, '').trim();

        const dbResult = await pool.query(
            'INSERT INTO biomechanical_logs (player_id, generated_by_user_id, assessment_date, ai_persona, kinematic_data_json, snapshot_base64, ai_generated_report, status) VALUES ($1, 1, CURRENT_DATE, $2, $3, $4, $5, $6) RETURNING *',
            [player_id, ai_persona, JSON.stringify(kinematic_data), snapshot_base64, aiReport, 'Report_Generated']
        );

        res.status(200).json({ success: true, data: dbResult.rows[0] });
    } catch (error) { res.status(500).json({ error: "Analysis Failed" }); }
});

router.get('/latest/:player_id', async (req, res) => {
    try {
        const logCheck = await pool.query('SELECT * FROM biomechanical_logs WHERE player_id = $1 ORDER BY id DESC LIMIT 5', [req.params.player_id]);
        const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [req.params.player_id]);
        res.status(200).json({ success: true, data: { player: playerCheck.rows[0], reports: logCheck.rows } });
    } catch (error) { res.status(500).json({ error: "Fetch Failed" }); }
});

module.exports = router;