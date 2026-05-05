// routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze', async (req, res) => {
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;
    
    // Fallbacks for MVP testing
    const user_id = req.user ? req.user.id : 1; 

    try {
        const playerCheck = await pool.query(
            'SELECT * FROM players WHERE id = $1',
            [player_id]
        );

        if (playerCheck.rows.length === 0) {
            return res.status(404).json({ error: "Player not found in database." });
        }

        const player = playerCheck.rows[0];

        // Safely extract names regardless of legacy schema structure
        const playerName = player.name || `${player.first_name || ''} ${player.last_name || ''}`.trim() || "Athlete";
        const playerRole = player.role || player.primary_role || "Cricket Player";

        // PROMPT ENGINEERING
        let systemInstruction = "";
        if (ai_persona === "The Master") {
            systemInstruction = "You are an elite batting coach ('The Master'). Analyze the provided kinematic data. Write a supportive but highly analytical 2-paragraph biomechanical assessment for the parents, focusing on batting technique. Do not use complex jargon without explaining it.";
        } else if (ai_persona === "The Sultan") {
            systemInstruction = "You are an elite fast-bowling coach ('The Sultan'). Analyze the provided kinematic data. Write a supportive but highly analytical 2-paragraph biomechanical assessment for the parents, focusing on pace bowling mechanics, momentum, and injury prevention.";
        } else if (ai_persona === "The Magician") {
            systemInstruction = "You are an elite spin-bowling coach ('The Magician'). Analyze the provided kinematic data. Write a supportive but highly analytical 2-paragraph biomechanical assessment for the parents, focusing on spin mechanics, flight, and body rotation.";
        } else {
            systemInstruction = "You are an elite cricket coach. Analyze the provided kinematic data and write a 2-paragraph biomechanical assessment.";
        }

        const prompt = `
            ${systemInstruction}
            Player Name: ${playerName}
            Role: ${playerRole}
            Raw Kinematic Data: ${JSON.stringify(kinematic_data)}
            
            Generate the official Parent Report text now.
        `;

        console.log(`Triggering Gemini API for ${playerName}...`);
        
        // THE FIX: Switch to the free-tier friendly Flash model
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" }); 
        
        const result = await model.generateContent(prompt);
        const aiReport = result.response.text();

        // SAVE TO VAULT
        const insertQuery = `
            INSERT INTO biomechanical_logs 
            (player_id, generated_by_user_id, assessment_date, ai_persona, kinematic_data_json, snapshot_base64, ai_generated_report, status)
            VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'Report_Generated')
            RETURNING *;
        `;
        
        const dbResult = await pool.query(insertQuery, [
            player_id,
            user_id,
            ai_persona,
            JSON.stringify(kinematic_data),
            snapshot_base64,
            aiReport
        ]);

        res.status(200).json({
            success: true,
            message: "Elite Biomechanical Report generated successfully.",
            data: dbResult.rows[0]
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to process biomechanical data and generate AI report." });
    }
});

module.exports = router;