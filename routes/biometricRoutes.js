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

        // ==========================================
        // PROMPT ENGINEERING: THE SWPI MATRIX
        // ==========================================
        
        const biomechanicalRubric = `
            === SWPI PHYSIOLOGICAL BENCHMARKS ===
            You must judge the provided kinematic data strictly against these facts:

            BATTING (Front Knee Flexion):
            - Optimal: 120° to 135° (Athletic base)
            - Flaw (Stiff): > 145°. Drill to assign: 'Medicine Ball Squat & Throws' to train lower-body load.
            - Flaw (Collapsing): < 115°. Drill to assign: 'Bungee Cord Resisted Drives' for core stability.

            PACE BOWLING (Front Knee at Delivery):
            - Optimal (Braced): 165° to 180° (Maximum momentum transfer)
            - Flaw (Collapsing): < 150° (Leaking pace). Drill to assign: 'Straight-Leg Medball Slams' or 'Hurdle Step-Overs' to train front-leg resistance.

            SPIN BOWLING (Front Knee at Delivery):
            - Optimal: 140° to 160° (Allows for pivot and body rotation)
            - Flaw (Too Straight): > 165° (Prevents follow-through). Drill to assign: 'Towel Resistance Rotation'.
        `;

        const baseCoachRules = `
            CRITICAL DIRECTIVE: You are an objective, constructive youth cricket coach evaluating a developing junior player.
            - Speak in simple, layman's terms so parents can easily understand. Avoid complex coaching jargon.
            - DO NOT over-praise or use words like "elite" or "perfect" if the data shows a flaw. Be honest but encouraging.
            - Compare their raw numbers to the Optimal benchmarks in the SWPI Matrix.
            - Prescribe ONLY the specific drills assigned in the SWPI Benchmarks. Do not invent your own drills.
            - STRICT FORMAT: You MUST respond with exactly 3 concise bullet points. No introductory fluff, no concluding remarks. Start immediately with the bullets.
              * Bullet 1 (The Numbers): Explain what the specific angle measured means for their body in plain English (Max 2 sentences).
              * Bullet 2 (Strengths & Flaws): Point out one good thing they are doing, and what specific mechanical flaw the data reveals (Max 2 sentences).
              * Bullet 3 (The Fix): Name the prescribed SWPI drill and briefly explain how it corrects the flaw (Max 2 sentences).
        `;

        let systemInstruction = "";

        if (ai_persona === "The Master") {
            systemInstruction = `${biomechanicalRubric} ${baseCoachRules} Role: 'The Master' (Batting Coach).`;
        } else if (ai_persona === "The Sultan") {
            systemInstruction = `${biomechanicalRubric} ${baseCoachRules} Role: 'The Sultan' (Fast-Bowling Coach).`;
        } else if (ai_persona === "The Magician") {
            systemInstruction = `${biomechanicalRubric} ${baseCoachRules} Role: 'The Magician' (Spin Coach).`;
        } else {
            systemInstruction = `${biomechanicalRubric} ${baseCoachRules} Role: Youth Cricket Coach.`;
        }

        const prompt = `
            ${systemInstruction}
            Player Name: ${playerName}
            Role: ${playerRole}
            Raw Kinematic Data: ${JSON.stringify(kinematic_data)}
            
            Generate the official Parent Report text now.
        `;

        console.log(`Triggering Gemini API with 3-Bullet Layman Rubric for ${playerName}...`);
        
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName }); 
        
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
            message: "Layman 3-Bullet Biomechanical Report generated successfully.",
            data: dbResult.rows[0]
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to process biomechanical data and generate AI report." });
    }
});

module.exports = router;