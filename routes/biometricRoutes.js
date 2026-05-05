// routes/biometricRoutes.js
const express = require('express');
const router = express.Router();
const pool = require('../db'); 
const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize the Google SDK using your secret API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

router.post('/analyze', async (req, res) => {
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;
    
    // Fallbacks for MVP testing
    const user_id = req.user ? req.user.id : 1; 

    try {
        // 1. Fetch player details
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

        // 2. PROMPT ENGINEERING: The "Constructive Candor" Update
        let systemInstruction = "";
        
        const baseCoachRules = `
            CRITICAL DIRECTIVE: You are an objective, strict, but constructive youth cricket coach. You are evaluating a developing junior player, NOT a professional. 
            - DO NOT use words like "elite", "exceptional", "superb", or "perfect".
            - DO NOT over-praise raw data. Treat the numbers as a starting baseline, not an achievement.
            - Focus on the "Developmental Gap": What does this player need to fix to survive at the next level of competitive cricket?
            - Maintain an encouraging tone, but be completely honest about their flaws.
        `;

        if (ai_persona === "The Master") {
            systemInstruction = `${baseCoachRules} 
            Role: 'The Master' (Batting Coach). 
            Format your response in two strict paragraphs:
            1. Objective Reality: State what the knee flexion and arm rotation numbers actually mean for their stance and bat swing. Keep it neutral.
            2. The Work Ahead: Identify a likely technical flaw associated with these numbers (e.g., losing balance, dropping the shoulder) and prescribe one specific, actionable drill to fix it.`;
        } else if (ai_persona === "The Sultan") {
            systemInstruction = `${baseCoachRules} 
            Role: 'The Sultan' (Fast-Bowling Coach). 
            Format your response in two strict paragraphs:
            1. Objective Reality: State what the kinematic data means for their run-up rhythm and delivery stride. Keep it neutral.
            2. The Work Ahead: Identify a likely technical flaw (e.g., collapsing the front knee, lost momentum) and prescribe one specific, actionable drill to fix it.`;
        } else if (ai_persona === "The Magician") {
            systemInstruction = `${baseCoachRules} 
            Role: 'The Magician' (Spin-Bowling Coach). 
            Format your response in two strict paragraphs:
            1. Objective Reality: State what the kinematic data means for their body rotation and flight mechanics. Keep it neutral.
            2. The Work Ahead: Identify a likely technical flaw (e.g., lack of pivot, dropping the arm) and prescribe one specific, actionable drill to fix it.`;
        } else {
            systemInstruction = `${baseCoachRules} You are an objective youth cricket coach. Write a 2-paragraph assessment focusing on neutral data observation and one specific area for technical improvement.`;
        }

        const prompt = `
            ${systemInstruction}
            Player Name: ${playerName}
            Role: ${playerRole}
            Raw Kinematic Data: ${JSON.stringify(kinematic_data)}
            
            Generate the official Parent Report text now.
        `;

        console.log(`Triggering Gemini API for ${playerName}...`);
        
        // 3. THE MODEL: Use environment variable or default to active free-tier 2.5 Flash
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName }); 
        
        const result = await model.generateContent(prompt);
        const aiReport = result.response.text();

        // 4. SAVE TO VAULT
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
            message: "Constructive Biomechanical Report generated successfully.",
            data: dbResult.rows[0]
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to process biomechanical data and generate AI report." });
    }
});

module.exports = router;