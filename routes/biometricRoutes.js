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
            - Optimal Knee Flexion (Athletic Base): 130° to 150°. (If > 150°, player is too upright and stiff, losing power generation. If < 120°, player is crouching too low, restricting footwork).
            - Optimal Lead Arm Bend (Load): 90° to 120°.`;
        } else if (ai_persona === "The Sultan") {
            systemInstruction = `You are an elite, strict fast-bowling coach ('The Sultan'). ${baseRules} 
            BENCHMARKS:
            - Optimal Front Knee Angle (Braced Front Leg): 160° to 180°. (If < 150°, it is a 'collapsing' front knee. This dissipates horizontal momentum, reduces ball speed, and increases lumbar spine stress).
            - Optimal Bowling Arm: Must remain relatively straight near 180° during delivery to comply with laws and maximize lever length.`;
        } else if (ai_persona === "The Magician") {
            systemInstruction = `You are an elite, strict spin-bowling coach ('The Magician'). ${baseRules} 
            BENCHMARKS:
            - Optimal Front Knee Angle: 140° to 165° (Braced but slightly softer than pace bowling to allow for hip pivot and body rotation).
            - Optimal Head Alignment: Head must remain perfectly over the front foot (Ratio near 0.00).`;
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

        console.log(`Triggering Gemini API for ${playerName}...`);
        
        // Dynamic Env Variable with the free-tier Flash fallback
        const targetModel = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: targetModel }); 
        
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