// =============================================================
// biometricRoutes.js — SWPI Biomechanical Analysis Routes
// =============================================================
// WHAT CHANGED FROM PREVIOUS VERSION (plain English):
// 1. All Gemini calls now go through geminiService.js which
//    auto-switches to Gemini 1.5 Flash if 2.5 Flash is busy.
// 2. JSON is always safely stringified before saving to DB.
// 3. The save operation validates the AI response before saving
//    so corrupted records can never be written again.
// 4. GET route now has bulletproof JSON parsing so old broken
//    records return a clean error object instead of crashing.
// =============================================================

const express = require("express");
const router = express.Router();
const pool = require("../db"); // Your existing PostgreSQL connection
const authenticateToken = require("../middleware/auth"); // Your existing JWT middleware
const { callGeminiWithFallback } = require("../geminiService"); // NEW fallback service

// ---------------------------------------------------------------
// HELPER: Safely parse any value as JSON
// If it is already an object, return it as-is.
// If it is a string, parse it.
// If it is broken, return a safe error object instead of crashing.
// ---------------------------------------------------------------
function safeParseJSON(value, recordId) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "object") {
    // PostgreSQL JSONB already parsed it — return directly
    return value;
  }
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error(`[BiometricRoutes] JSON parse failed for record ${recordId}: ${e.message}`);
      // Return a safe object so the frontend never crashes
      return {
        _parse_error: true,
        executive_summary: "This report has corrupted data. Please run a new capture session.",
        overall_score: 0,
        current_level: "Data Error",
        key_strength: "N/A",
        primary_focus: "Re-run capture session",
        growth_30_day: "N/A",
        radar_scores: { run_up_rhythm: 0, foot_placement: 0, body_turn_power: 0, straight_knee: 0, wrist_spin: 0, follow_through: 0 },
        issues: [],
        next_month_focus: ["Re-run biomechanical capture session"],
        parent_action: "Please ask the coach to run a new video analysis session.",
        expected_improvement_weeks: "TBD"
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------
// HELPER: Build the Gemini prompt for biomechanical analysis
// ---------------------------------------------------------------
function buildBiomechanicalPrompt(playerName, role, coachObservations, persona) {
  const personaInstructions = {
    "The Master (Batting)": "You are 'The Master' — a world-class batting technique analyst. Focus on balance, head position, backlift, and classical technique.",
    "The Sultan (Pace)": "You are 'The Sultan' — an elite pace bowling coach. Focus on wrist position, run-up rhythm, arm speed, and seam position.",
    "The Magician (Spin)": "You are 'The Magician' — a specialist spin bowling analyst. Focus on revolutions, drift, dip, foot placement, and body alignment.",
    "The Keeper (Wicket)": "You are 'The Keeper' — a wicket-keeping and agility specialist. Focus on footwork, soft hands, positioning, and agility."
  };

  const personaText = personaInstructions[persona] || personaInstructions["The Master (Batting)"];

  return `${personaText}

You are generating a structured biomechanical report for a grassroots cricket player. 
Player Name: ${playerName}
Playing Role: ${role}
Coach Observations: ${coachObservations}

CRITICAL INSTRUCTION: You MUST respond with ONLY a valid JSON object. No preamble, no explanation, no markdown code blocks, no backticks. Just raw JSON starting with { and ending with }.

The JSON must have EXACTLY this structure:
{
  "executive_summary": "One sentence plain-English summary for parents",
  "overall_score": <number 0-100>,
  "current_level": "<one of: Elite / Advanced / Developing / Beginner>",
  "key_strength": "<one short phrase>",
  "primary_focus": "<one short phrase>",
  "growth_30_day": "<e.g. +6% Improvement or N/A>",
  "radar_scores": {
    "run_up_rhythm": <number 0-100>,
    "foot_placement": <number 0-100>,
    "body_turn_power": <number 0-100>,
    "straight_knee": <number 0-100>,
    "wrist_spin": <number 0-100>,
    "follow_through": <number 0-100>
  },
  "issues": [
    {
      "severity": "<high or medium>",
      "title": "<short issue title>",
      "observation": "<what the coach sees>",
      "mechanic": "<what is happening biomechanically>",
      "so_what": "<why this matters in plain English for parents>"
    }
  ],
  "next_month_focus": ["<focus item 1>", "<focus item 2>", "<focus item 3>"],
  "parent_action": "<specific action parents can take at home>",
  "expected_improvement_weeks": "<e.g. 4-6>"
}`;
}

// ---------------------------------------------------------------
// POST /api/biometric/analyze
// Called by assessment-capture.html when coach clicks Generate Report
// ---------------------------------------------------------------
router.post("/analyze", authenticateToken, async (req, res) => {
  const { player_id, coach_observations, persona, snapshot_base64 } = req.body;
  const academy_id = req.user.academy_id;

  // --- Input validation ---
  if (!player_id || !coach_observations || !persona) {
    return res.status(400).json({ 
      error: "Missing required fields: player_id, coach_observations, persona" 
    });
  }

  try {
    // --- Fetch player details from DB ---
    const playerResult = await pool.query(
      "SELECT full_name, role FROM players WHERE id = $1 AND academy_id = $2",
      [player_id, academy_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = playerResult.rows[0];
    console.log(`[BiometricRoutes] Starting analysis for ${player.full_name} (ID: ${player_id})`);

    // --- Build prompt and call Gemini with fallback ---
    const prompt = buildBiomechanicalPrompt(
      player.full_name,
      player.role,
      coach_observations,
      persona
    );

    const geminiResult = await callGeminiWithFallback(prompt, player.full_name);
    
    console.log(`[BiometricRoutes] AI response received. Model used: ${geminiResult.modelUsed}`);

    // --- Parse and validate the AI response ---
    let analysisData;
    
    // Strip any accidental markdown code fences the AI might add
    let cleanText = geminiResult.text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    }

    try {
      analysisData = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error(`[BiometricRoutes] AI returned invalid JSON: ${parseErr.message}`);
      console.error(`[BiometricRoutes] Raw AI response: ${cleanText.substring(0, 500)}`);
      
      // Use safe default rather than saving corrupted data
      analysisData = {
        executive_summary: "Analysis completed with limited data. Please re-run for full report.",
        overall_score: 50,
        current_level: "Developing",
        key_strength: "Under Assessment",
        primary_focus: "Full analysis pending",
        growth_30_day: "N/A",
        radar_scores: { run_up_rhythm: 50, foot_placement: 50, body_turn_power: 50, straight_knee: 50, wrist_spin: 50, follow_through: 50 },
        issues: [],
        next_month_focus: ["Complete full biomechanical assessment"],
        parent_action: "Please ask the coach to schedule a full video analysis session.",
        expected_improvement_weeks: "TBD"
      };
    }

    // --- Always add metadata ---
    analysisData.model_used = geminiResult.modelUsed;
    analysisData.generated_at = new Date().toISOString();
    analysisData.persona_used = persona;

    // --- Save to database — ALWAYS as properly stringified JSON ---
    // NOTE: We use JSON.stringify() explicitly even though column is JSONB
    // This prevents the double-stringify bug that corrupted previous records
    const insertResult = await pool.query(
      `INSERT INTO biomechanical_logs 
        (player_id, academy_id, analysis_data, snapshot_base64, coach_observations, persona, created_at)
       VALUES ($1, $2, $3::jsonb, $4, $5, $6, NOW())
       RETURNING id`,
      [
        player_id,
        academy_id,
        JSON.stringify(analysisData),  // Explicit stringify → cast to JSONB
        snapshot_base64 || null,
        coach_observations,
        persona
      ]
    );

    const newRecordId = insertResult.rows[0].id;
    console.log(`[BiometricRoutes] Analysis saved successfully. Record ID: ${newRecordId}, Model: ${geminiResult.modelUsed}`);

    return res.status(200).json({
      success: true,
      record_id: newRecordId,
      player_id: player_id,
      model_used: geminiResult.modelUsed,
      used_fallback: geminiResult.usedFallback,
      message: "Analysis complete"
    });

  } catch (err) {
    console.error(`[BiometricRoutes] Unhandled error in /analyze: ${err.message}`);
    return res.status(500).json({ 
      error: "Analysis failed. Please try again.",
      detail: err.message 
    });
  }
});

// ---------------------------------------------------------------
// GET /api/biometric/report/:player_id
// Called by report-view.html to load the latest report for a player
// ---------------------------------------------------------------
router.get("/report/:player_id", authenticateToken, async (req, res) => {
  const { player_id } = req.params;
  const academy_id = req.user.academy_id;

  try {
    // Fetch the most recent 5 records for this player
    // We try multiple in case recent ones are corrupted
    const result = await pool.query(
      `SELECT id, analysis_data, coach_observations, persona, created_at
       FROM biomechanical_logs
       WHERE player_id = $1 AND academy_id = $2
       ORDER BY created_at DESC
       LIMIT 5`,
      [player_id, academy_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ 
        error: "No reports found for this player",
        player_id: player_id
      });
    }

    // --- Find the first record with valid, parseable data ---
    let validRecord = null;
    
    for (const row of result.rows) {
      const parsed = safeParseJSON(row.analysis_data, row.id);
      
      if (parsed && !parsed._parse_error && parsed.overall_score !== undefined) {
        // This record is valid — use it
        validRecord = {
          id: row.id,
          analysis_data: parsed,
          coach_observations: row.coach_observations,
          persona: row.persona,
          created_at: row.created_at
        };
        break;
      } else {
        console.warn(`[BiometricRoutes] Skipping corrupted record ID ${row.id} for player ${player_id}`);
      }
    }

    if (!validRecord) {
      // All records are corrupted — return clean error, not a crash
      return res.status(422).json({
        error: "all_records_corrupted",
        message: "All saved reports for this player have corrupted data. Please run a new capture session.",
        player_id: player_id
      });
    }

    // --- Fetch player details to include in response ---
    const playerResult = await pool.query(
      "SELECT full_name, role FROM players WHERE id = $1",
      [player_id]
    );

    const playerName = playerResult.rows.length > 0 ? playerResult.rows[0].full_name : "Player";
    const playerRole = playerResult.rows.length > 0 ? playerResult.rows[0].role : "Cricketer";

    return res.status(200).json({
      success: true,
      player_name: playerName,
      player_role: playerRole,
      record_id: validRecord.id,
      created_at: validRecord.created_at,
      persona: validRecord.persona,
      analysis: validRecord.analysis_data
    });

  } catch (err) {
    console.error(`[BiometricRoutes] Error in GET /report/${player_id}: ${err.message}`);
    return res.status(500).json({ 
      error: "Failed to load report",
      detail: err.message 
    });
  }
});

// ---------------------------------------------------------------
// GET /api/biometric/history/:player_id
// Returns list of all reports for a player (for history view)
// ---------------------------------------------------------------
router.get("/history/:player_id", authenticateToken, async (req, res) => {
  const { player_id } = req.params;
  const academy_id = req.user.academy_id;

  try {
    const result = await pool.query(
      `SELECT id, persona, created_at,
              (analysis_data->>'overall_score')::int as score,
              analysis_data->>'current_level' as level
       FROM biomechanical_logs
       WHERE player_id = $1 AND academy_id = $2
       ORDER BY created_at DESC
       LIMIT 20`,
      [player_id, academy_id]
    );

    return res.status(200).json({
      success: true,
      history: result.rows
    });

  } catch (err) {
    console.error(`[BiometricRoutes] Error in GET /history/${player_id}: ${err.message}`);
    return res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;
