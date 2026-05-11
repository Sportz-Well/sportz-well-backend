'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const { authenticate } = require('../middleware/authMiddleware');

// Initialize the Google SDK
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ==========================================
// ENTERPRISE RETRY LOGIC & FALLBACK
// ==========================================
async function fetchFromGeminiWithRetry(model, prompt, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            console.error(`[Attempt ${i + 1}] API Error:`, error.message);
            if (error.status === 503 && i < retries - 1) {
                const waitTime = Math.pow(2, i) * 1500;
                console.log(`Server busy. Retrying in ${waitTime}ms...`);
                await new Promise(res => setTimeout(res, waitTime));
            } else if (i === retries - 1) {
                console.log("All retries failed. Activating Fallback Report.");
                return JSON.stringify({
                    "radar_chart_scores": { "dynamic_balance": 5, "arm_extension": 5, "knee_bracing": 5, "wrist_snap": 5, "body_turn": 5 },
                    "executive_summary": ["System encountered high network latency.", "Basic kinematics recorded safely.", "Please review raw data or run analysis again later."],
                    "action_plan": "Focus on standard foundational drills today.",
                    "holistic_wellness": { "injury_prevention": "Ensure proper warm-up to prevent strain.", "mindset_quote": "Discipline is doing what needs to be done.", "pro_tip": "Hydration is key during high-load sessions." }
                });
            } else {
                throw error;
            }
        }
    }
}

// ---------------------------------------------------------
// ROUTE 1: ANALYZE AND SAVE (Protected)
// ---------------------------------------------------------
router.post('/analyze', authenticate, async (req, res) => {
    const { player_id, ai_persona, kinematic_data, snapshot_base64 } = req.body;
    const user_id = req.user.id;
    const secureAcademyId = req.user.academy_id;

    try {
        // Security check: confirm this player belongs to the coach's academy
        const playerCheck = await pool.query(
            'SELECT * FROM players WHERE id = $1 AND academy_id = $2',
            [player_id, secureAcademyId]
        );

        if (playerCheck.rows.length === 0) {
            return res.status(403).json({ error: "Access denied or Player not found." });
        }

        const player = playerCheck.rows[0];

        // Business rule: 1 report per player per month
        const rateLimitCheck = await pool.query(`
            SELECT id FROM biomechanical_logs 
            WHERE player_id = $1 
            AND EXTRACT(MONTH FROM assessment_date) = EXTRACT(MONTH FROM CURRENT_DATE)
            AND EXTRACT(YEAR FROM assessment_date) = EXTRACT(YEAR FROM CURRENT_DATE)
        `, [player_id]);

        if (rateLimitCheck.rows.length > 0) {
            return res.status(429).json({
                success: false,
                error: "Rate Limit Exceeded: Head Coach is restricted to 1 Biomechanical Report per player, per month."
            });
        }

        const prompt = `
            STRICT DIRECTIVE: You are the SWPI Master Biomechanical Engine. 
            NEVER mention you are an AI or use AI-related terminology.
            Analyze these kinematics for a ${player.role || "Cricket Player"}: ${JSON.stringify(kinematic_data)}.
            
            CRICKETING BENCHMARKS:
            - BATTING KNEE: Ideal is 120°-135°. If >145°, it is a COLLAPSE (Score < 4). 
            - ARM ROTATION: If high (>70°) but Knee is collapsed, it is a technical FAILURE in the kinetic chain.
            - SCORE RUTHLESSLY: Do not give high scores to beginners. A 70/100 is for a District-level player.
            
            OUTPUT JSON ONLY:
            1. "radar_chart_scores": { "dynamic_balance", "arm_extension", "knee_bracing", "wrist_snap", "body_turn" } (1-10).
            2. "executive_summary": Array of 3 professional technical observations.
            3. "action_plan": 2 technical sentences.
            4. "holistic_wellness": { "injury_prevention", "mindset_quote", "pro_tip" }
        `;

        console.log(`Triggering SWPI Engine for Player ID ${player_id}...`);

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        let aiReport = await fetchFromGeminiWithRetry(model, prompt);

        // Strip markdown fences if Gemini wraps the JSON in them
        if (aiReport.startsWith('```json')) aiReport = aiReport.replace(/```json/g, '');
        if (aiReport.startsWith('```')) aiReport = aiReport.replace(/```/g, '');
        aiReport = aiReport.trim();

        /*
            STORAGE NOTE:
            aiReport is a JSON string. We save it as a plain TEXT string in the DB.
            If your column type is JSONB, PostgreSQL will parse it into an object
            on retrieval — which breaks the frontend parser.
            We store it as a string and always stringify on the way out (see Route 2).
        */
        const insertQuery = `
            INSERT INTO biomechanical_logs 
            (player_id, generated_by_user_id, assessment_date, ai_persona, kinematic_data_json, snapshot_base64, ai_generated_report, status)
            VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, 'Report_Generated')
            RETURNING *;
        `;

        const dbResult = await pool.query(insertQuery, [
            player_id, user_id, ai_persona, JSON.stringify(kinematic_data), snapshot_base64, aiReport
        ]);

        res.status(200).json({ success: true, data: dbResult.rows[0] });

    } catch (error) {
        console.error("AI Generation Fatal Error:", error);
        res.status(500).json({ error: "Failed to process biomechanical data and generate report." });
    }
});

// ---------------------------------------------------------
// ROUTE 2: FETCH THE LATEST REPORT (Protected)
// ---------------------------------------------------------
router.get('/latest/:player_id', authenticate, async (req, res) => {
    try {
        const { player_id } = req.params;
        const secureAcademyId = req.user.academy_id;

        // Security check: confirm this player belongs to the coach's academy
        const playerCheck = await pool.query(
            'SELECT id, name, role FROM players WHERE id = $1 AND academy_id = $2',
            [player_id, secureAcademyId]
        );

        if (playerCheck.rows.length === 0) {
            return res.status(403).json({ error: "Access denied or Player not found." });
        }

        const playerData = playerCheck.rows[0];

        const logCheck = await pool.query(
            'SELECT * FROM biomechanical_logs WHERE player_id = $1 ORDER BY id DESC LIMIT 5',
            [player_id]
        );

        if (logCheck.rows.length === 0) {
            return res.status(404).json({ success: false, error: "No reports found for this player." });
        }

        /*
            THE CORE FIX:
            PostgreSQL JSONB columns automatically parse stored JSON into objects
            when they are returned. The frontend's safeParseJSON() expects a STRING
            to parse — if it receives an object, JSON.parse() crashes with
            "Unexpected non-whitespace character" or "[object Object] is not valid JSON".

            Solution: before sending to the frontend, we check each field.
            If it is already an object (parsed by PostgreSQL), we re-stringify it
            back into a string so the frontend always receives consistent string input.
            This works regardless of whether the column is TEXT or JSONB.
        */
        const normalizedReports = logCheck.rows.map(row => ({
            ...row,
            ai_generated_report: typeof row.ai_generated_report === 'object'
                ? JSON.stringify(row.ai_generated_report)
                : row.ai_generated_report,
            kinematic_data_json: typeof row.kinematic_data_json === 'object'
                ? JSON.stringify(row.kinematic_data_json)
                : row.kinematic_data_json
        }));

        res.status(200).json({
            success: true,
            data: {
                player: playerData,
                reports: normalizedReports
            }
        });

    } catch (error) {
        console.error("Database Fetch Error:", error);
        res.status(500).json({ success: false, error: "Database Fetch Failed", details: error.message });
    }
});

module.exports = router;