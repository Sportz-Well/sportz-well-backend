// routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze', async (req, res) => {
    // NEW: We now extract snapshot_base64 from the incoming request
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;
    
    // Fallbacks for MVP testing if JWT isn't fully active yet
    const user_id = req.user ? req.user.id : 1; 
    const academy_id = req.user ? req.user.academy_id : 1;

    try {
        const playerCheck = await pool.query(
            'SELECT id, first_name, last_name, primary_role FROM players WHERE id = $1 AND academy_id = $2',
            [player_id, academy_id]
        );

        if (playerCheck.rows.length === 0) {
            return res.status(403).json({ error: "Access Denied: Player does not exist in your academy vault." });
        }

        const player = playerCheck.rows[0];

        // PROMPT ENGINEERING
        let systemInstruction = "";
        if (ai_persona === "The Master") {
            systemInstruction = "You are an elite batting coach ('The Master'). Analyze the provided kinematic data (joint angles, posture). Write a supportive but highly analytical 2-paragraph biomechanical assessment for the parents, focusing on batting technique. Do not use complex jargon without explaining it.";
        } else if (ai_persona === "The Sultan") {
            systemInstruction = "You are an elite fast-bowling coach ('The Sultan'). Analyze the provided kinematic data. Write a supportive but highly analytical 2-paragraph biomechanical assessment for the parents, focusing on pace bowling mechanics, momentum, and injury prevention.";
        } else if (ai_persona === "The Magician") {
            systemInstruction = "You are an elite spin-bowling coach ('The Magician'). Analyze the provided kinematic data. Write a supportive but highly analytical 2-paragraph biomechanical assessment for the parents, focusing on spin mechanics, flight, and body rotation.";
        } else {
            systemInstruction = "You are an elite cricket coach. Analyze the provided kinematic data and write a 2-paragraph biomechanical assessment for the parents.";
        }

        const prompt = `
            ${systemInstruction}
            Player Name: ${player.first_name} ${player.last_name}
            Role: ${player.primary_role}
            Raw Kinematic Data (Averaged over 3 clips): ${JSON.stringify(kinematic_data)}
            
            Generate the official Parent Report text now.
        `;

        console.log(`Triggering Gemini API for Player ID: ${player_id}...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 
        const result = await model.generateContent(prompt);
        const aiReport = result.response.text();

        // SAVE TO VAULT: Now includes the snapshot_base64 payload
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
            snapshot_base64, // Pushing the image string into the db
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