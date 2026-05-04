// routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini API securely using the .env variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// POST /api/v1/biometrics/analyze
// This endpoint receives the browser-extracted kinematics and generates the AI Report
router.post('/analyze', async (req, res) => {
    // 1. Extract payload from the incoming Vercel frontend request
    const { player_id, ai_persona, kinematic_data } = req.body;
    
    // We extract the user and academy ID from the JWT auth token 
    // (Assuming your standard auth middleware attaches req.user)
    const user_id = req.user.id; 
    const academy_id = req.user.academy_id;

    try {
        // 2. STRICT SECURITY CHECK: Ensure this player belongs to the coach's academy
        const playerCheck = await pool.query(
            'SELECT id, first_name, last_name, primary_role FROM players WHERE id = $1 AND academy_id = $2',
            [player_id, academy_id]
        );

        if (playerCheck.rows.length === 0) {
            return res.status(403).json({ 
                error: "Access Denied: Player does not exist in your academy vault." 
            });
        }

        const player = playerCheck.rows[0];

        // 3. PROMPT ENGINEERING: Load the AI Persona
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

        // Construct the final payload for Gemini
        const prompt = `
            ${systemInstruction}
            Player Name: ${player.first_name} ${player.last_name}
            Role: ${player.primary_role}
            Raw Kinematic Data (Averaged over 3 clips): ${JSON.stringify(kinematic_data)}
            
            Generate the official Parent Report text now.
        `;

        // 4. CALL GEMINI API
        console.log(`Triggering Gemini API for Player ID: ${player_id}...`);
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" }); 
        const result = await model.generateContent(prompt);
        const aiReport = result.response.text();

        // 5. SAVE TO VAULT: Log the data and the generated report into PostgreSQL
        const insertQuery = `
            INSERT INTO biomechanical_logs 
            (player_id, generated_by_user_id, assessment_date, ai_persona, kinematic_data_json, ai_generated_report, status)
            VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, 'Report_Generated')
            RETURNING *;
        `;
        
        const dbResult = await pool.query(insertQuery, [
            player_id,
            user_id,
            ai_persona,
            JSON.stringify(kinematic_data),
            aiReport
        ]);

        // 6. RESPOND TO FRONTEND
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