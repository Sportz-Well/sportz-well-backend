// routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// --- 1. THE CREATION ROUTE (POST) ---
router.post('/analyze', async (req, res) => {
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;
    const user_id = req.user ? req.user.id : 1; 

    try {
        const playerCheck = await pool.query('SELECT * FROM players WHERE id = $1', [player_id]);
        if (playerCheck.rows.length === 0) {
            return res.status(404).json({ error: "Player not found in database." });
        }

        const player = playerCheck.rows[0];
        const playerName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || "Athlete";
        const playerRole = player.role || player.primary_role || "Cricket Player";

        // PROMPT ENGINEERING: PARENT-FRIENDLY & BULLET POINTS
        let systemInstruction = "";
        const baseRules = `Tone: Simple, encouraging, and easy for a parent with no sports-science background to understand. Do NOT use heavy technical jargon. Keep sentences short and punchy.
        Structure: Write exactly three sections using these exact markdown headings:
        ### EXECUTIVE SUMMARY
        Write 2 simple sentences summarizing the player's core mechanics.
        ### TECHNICAL BREAKDOWN
        Use bullet points. State the 'Data' (the angles) and explain 'What this means' in plain English. Point out one good thing and one thing to fix. Example: "The knee bends at 148°. What this means: The leg is collapsing a bit, which loses power."
        ### ACTION PLAN
        Prescribe 2 easy-to-understand drills to fix the main flaw.`;

        if (ai_persona === "The Master") {
            systemInstruction = `You are an elite batting coach ('The Master') speaking to a parent. ${baseRules} 
            BENCHMARKS (For your knowledge, explain simply): Optimal Knee Flexion: 130°-150°. Optimal Arm Bend: 90°-120°.`;
        } else if (ai_persona === "The Sultan") {
            systemInstruction = `You are an elite fast-bowling coach ('The Sultan') speaking to a parent. ${baseRules} 
            BENCHMARKS (For your knowledge, explain simply): Optimal Front Knee Angle: 160°-180°. Optimal Bowling Arm: near 180°.`;
        } else if (ai_persona === "The Magician") {
            systemInstruction = `You are an elite spin-bowling coach ('The Magician') speaking to a parent. ${baseRules} 
            BENCHMARKS (For your knowledge, explain simply): Optimal Front Knee Angle: 140°-165°.`;
        } else {
            systemInstruction = `You are an elite cricket coach speaking to a parent. ${baseRules}`;
        }

        const prompt = `
            ${systemInstruction}
            Player Name: ${playerName}
            Role: ${playerRole}
            Raw Kinematic Data: ${JSON.stringify(kinematic_data)}
            Generate the official Parent Report text now.
        `;

        const targetModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: targetModel }); 
        const result = await model.generateContent(prompt);
        const aiReport = result.response.text();

        const insertQuery = `
            INSERT INTO biomechanical_logs 
            (player_id, generated_by_user_id, assessment_date, ai_persona, kinematic_data_json, snapshot_base64, ai_generated_report, status)
            VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'Report_Generated')
            RETURNING *;
        `;
        
        const dbResult = await pool.query(insertQuery, [player_id, user_id, ai_persona, JSON.stringify(kinematic_data), snapshot_base64, aiReport]);

        res.status(200).json({ success: true, message: "Report generated successfully.", data: dbResult.rows[0] });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to process data and generate AI report." });
    }
});

// --- 2. THE FETCH ROUTE (GET) ---
router.get('/latest/:player_id', async (req, res) => {
    const { player_id } = req.params;
    try {
        const logQuery = `SELECT * FROM biomechanical_logs WHERE player_id = $1 ORDER BY assessment_date DESC, id DESC LIMIT 1;`;
        const logResult = await pool.query(logQuery, [player_id]);
        
        if (logResult.rows.length === 0) return res.status(404).json({ error: "No biomechanical report found for this player." });
        
        const reportData = logResult.rows[0];
        const playerQuery = `SELECT * FROM players WHERE id = $1`;
        const playerResult = await pool.query(playerQuery, [player_id]);
        
        if (playerResult.rows.length > 0) {
            const p = playerResult.rows[0];
            reportData.name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || "Athlete";
            reportData.primary_role = p.role || p.primary_role || "Cricket Player";
        } else {
            reportData.name = "Athlete"; reportData.primary_role = "Cricket Player";
        }
        
        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        console.error("Fetch Error:", error); res.status(500).json({ error: "Failed to retrieve the report." });
    }
});

module.exports = router;