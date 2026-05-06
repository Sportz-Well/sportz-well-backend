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
        // PROMPT ENGINEERING: THE SWPI JSON ENGINE
        // ==========================================
        
        const biomechanicalRubric = `
            === SWPI PHYSIOLOGICAL BENCHMARKS (DO NOT GUESS) ===
            Judge the provided kinematic data strictly against these facts:

            BATTING (Front Knee Flexion):
            - Optimal: 120° to 135°. Assessment: Athletic base. Drill to assign: 'Stationary Drop-Ball Drives' to maintain perfect posture.
            - Flaw (Stiff): > 145°. Drill to assign: 'Medicine Ball Squat & Throws' to train lower-body load.
            - Flaw (Collapsing): < 115°. Drill to assign: 'Bungee Cord Resisted Drives' for core stability.

            PACE BOWLING (Front Knee at Delivery):
            - Optimal (Braced): 165° to 180°. Assessment: Maximum momentum transfer. Drill to assign: 'Walk-Through Target Drill' to maintain bracing.
            - Flaw (Collapsing): < 150° (Leaking pace). Drill to assign: 'Straight-Leg Medball Slams' or 'Hurdle Step-Overs' to train front-leg resistance.

            SPIN BOWLING (Front Knee at Delivery):
            - Optimal: 140° to 160°. Assessment: Allows for pivot and body rotation. Drill to assign: 'Crease Freeze' to maintain balance.
            - Flaw (Too Straight): > 165° (Prevents follow-through). Drill to assign: 'Towel Resistance Rotation'.
        `;

        const baseCoachRules = `
            === COACHING PERSONA & TONE ===
            CRITICAL DIRECTIVE: You are the "SWPI Master" — an elite AI mentor. Your analysis is a fusion of:
            1. Rahul Dravid: Technical, process-driven, strict on basic flaws.
            2. Sachin Tendulkar: Instinctive, focuses on natural intent, highly encouraging.
            
            - Speak in simple, layman's terms so a mother with no cricket background understands instantly.
            - Be honest about flaws but highly encouraging. Do not over-praise if there is a flaw.
            - Prescribe ONLY the specific drills assigned in the SWPI Benchmarks above. Do not invent drills.
        `;

        const jsonFormattingRules = `
            === STRICT OUTPUT FORMAT (JSON ONLY) ===
            You MUST return your entire response as a valid JSON object. Do NOT wrap the JSON in markdown code blocks. Do NOT return any plain text outside the JSON.
            
            The JSON must contain exactly these three keys:

            1. "radar_chart_scores":
               Generate five scores (1 to 10) based ONLY on the kinematic data provided.
               Keys must be exact: "dynamic_balance", "arm_extension", "knee_bracing", "wrist_snap", "body_turn". 
               (Note: Safely estimate missing values based on overall balance).

            2. "executive_summary":
               Write an array of EXACTLY 3 simple, punchy strings (bullet points).
               - String 1 (The Numbers): What the specific angle measured means for their body in plain English.
               - String 2 (Strengths & Flaws): The Tendulkar view (one positive natural trait) combined with the Dravid view (the main mechanical flaw or area to maintain).
               - String 3 (The Fix): Name the prescribed SWPI drill and briefly explain how it helps.

            3. "action_plan":
               Write exactly 2 sentences. Match the player's data to the SWPI Benchmark. If they have a Flaw, assign the Correction Drill. If they are Optimal, assign the Maintenance Drill. Briefly explain how to execute it.
        `;

        // Assemble the final prompt
        const prompt = `
            ${biomechanicalRubric}
            ${baseCoachRules}
            ${jsonFormattingRules}

            Player Name: ${playerName}
            Role: ${playerRole}
            Raw Kinematic Data: ${JSON.stringify(kinematic_data)}
            
            GENERATE JSON NOW:
        `;

        console.log(`Triggering SWPI JSON Engine for ${playerName}...`);
        
        // Target the active, free-tier Flash model
        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName }); 
        
        const result = await model.generateContent(prompt);
        let aiReport = result.response.text();

        // Safety cleanup: Remove markdown formatting if the AI disobeys the "No markdown" rule
        if (aiReport.startsWith('\`\`\`json')) {
            aiReport = aiReport.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        } else if (aiReport.startsWith('\`\`\`')) {
            aiReport = aiReport.replace(/\`\`\`/g, '').trim();
        }

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
            message: "SWPI Elite JSON Report generated successfully.",
            data: dbResult.rows[0]
        });

    } catch (error) {
        console.error("AI Generation Error:", error);
        res.status(500).json({ error: "Failed to process biomechanical data and generate AI report." });
    }
});

module.exports = router;