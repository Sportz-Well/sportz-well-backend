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

        // PROMPT ENGINEERING: BENCHMARKS & DRILLS
        let systemInstruction = "";
        const baseRules = `Tone: Honest, strict, and highly analytical. You are evaluating a developing youth player against professional physiological benchmarks. Do NOT sugar-coat the assessment. Do NOT use overly enthusiastic words unless the metrics strictly fall within the optimal professional range.
        Structure: Write exactly three sections for the parents and coach.
        Section 1 (The Reality): State the raw kinematic numbers. Judge them strictly against the provided optimal benchmarks.
        Section 2 (The Flaws): Point out the mechanical flaws, energy leaks, or injury risks caused by these specific angles.
        Section 3 (The Prescription): Prescribe exactly 2 highly specific physical drills to correct the identified mechanical flaws.`;

        if (ai_persona === "The Master") {
            systemInstruction = `You are an elite, strict batting coach ('The Master'). ${baseRules} 
            BENCHMARKS: 
            - Optimal Knee Flexion (Athletic Base): 130° to 150°. 
            - Optimal Lead Arm Bend (Load): 90° to 120°.`;
        } else if (ai_persona === "The Sultan") {
            systemInstruction = `You are an elite, strict fast-bowling coach ('The Sultan'). ${baseRules} 
            BENCHMARKS:
            - Optimal Front Knee Angle: 160° to 180°.
            - Optimal Bowling Arm: Must remain near 180° during delivery.`;
        } else if (ai_persona === "The Magician") {
            systemInstruction = `You are an elite, strict spin-bowling coach ('The Magician'). ${baseRules} 
            BENCHMARKS:
            - Optimal Front Knee Angle: 140° to 165°.
            - Optimal Head Alignment: Ratio near 0.00.`;
        } else {
            systemInstruction = `You are an elite cricket coach. ${baseRules}`;
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
        // Step 1: Safely fetch ONLY the report data first
        const logQuery = `
            SELECT * FROM biomechanical_logs 
            WHERE player_id = $1 
            ORDER BY assessment_date DESC, id DESC 
            LIMIT 1;
        `;
        const logResult = await pool.query(logQuery, [player_id]);
        
        if (logResult.rows.length === 0) {
            return res.status(404).json({ error: "No biomechanical report found for this player." });
        }
        
        const reportData = logResult.rows[0];

        // Step 2: Fetch the player data separately and map it securely using JS
        const playerQuery = `SELECT * FROM players WHERE id = $1`;
        const playerResult = await pool.query(playerQuery, [player_id]);
        
        if (playerResult.rows.length > 0) {
            const p = playerResult.rows[0];
            reportData.name = p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim() || "Athlete";
            reportData.primary_role = p.role || p.primary_role || "Cricket Player";
        } else {
            reportData.name = "Athlete";
            reportData.primary_role = "Cricket Player";
        }
        
        res.status(200).json({ success: true, data: reportData });
    } catch (error) {
        console.error("Fetch Error:", error);
        res.status(500).json({ error: "Failed to retrieve the report." });
    }
});

module.exports = router;