// =============================================================
// biometricRoutes.js
// LOCATION: routes/biometricRoutes.js
// =============================================================
//
// COMMIT MESSAGE:
// fix: biometricRoutes.js — rewrite all DB column names to match
// actual biomechanical_logs table structure, fixes academy_id,
// analysis_data, coach_observations, persona column errors
//
// ACTUAL TABLE COLUMNS (confirmed from DB):
// id, player_id, generated_by_user_id, assessment_date,
// kinematic_data_json, created_at, ai_generated_report,
// status, ai_persona, snapshot_base64
//
// =============================================================

const express  = require("express");
const router   = express.Router();
const pool     = require("../config/db");
const { authenticate } = require("../middleware/authMiddleware");
const { callGeminiWithFallback } = require("../geminiService");

// ---------------------------------------------------------------
// HELPER: Safely parse JSON without crashing
// ---------------------------------------------------------------
function safeParseJSON(value, recordId) {
  if (value === null || value === undefined) return null;
  if (typeof value === "object") return value;
  if (typeof value === "string") {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error(`[BiometricRoutes] JSON parse failed for record ${recordId}: ${e.message}`);
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
// HELPER: Build Gemini prompt
// ---------------------------------------------------------------
function buildBiomechanicalPrompt(playerName, role, coachObservations, persona) {
  const personaMap = {
    "The Master (Batting)": "You are 'The Master' — a world-class batting technique analyst. Focus on balance, head position, backlift, and classical technique.",
    "The Sultan (Pace)":    "You are 'The Sultan' — an elite pace bowling coach. Focus on wrist position, run-up rhythm, arm speed, and seam position.",
    "The Magician (Spin)":  "You are 'The Magician' — a specialist spin bowling analyst. Focus on revolutions, drift, dip, foot placement, and body alignment.",
    "The Keeper (Wicket)":  "You are 'The Keeper' — a wicket-keeping and agility specialist. Focus on footwork, soft hands, positioning, and agility."
  };

  const personaText = personaMap[persona] || personaMap["The Master (Batting)"];

  return `${personaText}

You are generating a structured biomechanical report for a grassroots cricket player.
Player Name: ${playerName}
Playing Role: ${role || "Cricketer"}
Coach Observations & Kinematic Data: ${coachObservations}

CRITICAL: Respond with ONLY a valid JSON object. No preamble, no explanation, no markdown, no backticks. Raw JSON only.

Required JSON structure:
{
  "executive_summary": "One sentence plain-English summary for parents",
  "overall_score": <number 0-100>,
  "current_level": "<Elite / Advanced / Developing / Beginner>",
  "key_strength": "<one short phrase>",
  "primary_focus": "<one short phrase>",
  "growth_30_day": "<e.g. +6% Improvement or First Assessment>",
  "radar_scores": {
    "run_up_rhythm": <0-100>,
    "foot_placement": <0-100>,
    "body_turn_power": <0-100>,
    "straight_knee": <0-100>,
    "wrist_spin": <0-100>,
    "follow_through": <0-100>
  },
  "issues": [
    {
      "severity": "<high or medium>",
      "title": "<short title>",
      "observation": "<what coach sees>",
      "mechanic": "<what is happening biomechanically>",
      "so_what": "<why this matters in plain English for parents>"
    }
  ],
  "next_month_focus": ["<item 1>", "<item 2>", "<item 3>"],
  "parent_action": "<specific action parents can take at home>",
  "expected_improvement_weeks": "<e.g. 4-6>"
}`;
}

// ---------------------------------------------------------------
// POST /api/v1/biometrics/analyze
// ---------------------------------------------------------------
router.post("/analyze", authenticate, async (req, res) => {
  const { player_id, coach_observations, persona, snapshot_base64 } = req.body;
  const user_id = req.user.id;

  if (!player_id || !coach_observations || !persona) {
    return res.status(400).json({
      error: "Missing required fields: player_id, coach_observations, persona"
    });
  }

  try {
    // Fetch player — column is 'name' (confirmed from DB)
    const playerResult = await pool.query(
      "SELECT name, role FROM players WHERE id = $1",
      [player_id]
    );

    if (playerResult.rows.length === 0) {
      return res.status(404).json({ error: "Player not found" });
    }

    const player = playerResult.rows[0];
    console.log(`[BiometricRoutes] Starting analysis for ${player.name} (ID: ${player_id})`);

    // Call Gemini with fallback chain
    const prompt = buildBiomechanicalPrompt(player.name, player.role, coach_observations, persona);
    const geminiResult = await callGeminiWithFallback(prompt);
    console.log(`[BiometricRoutes] AI response received. Model: ${geminiResult.modelUsed}`);

    // Parse AI response — strip accidental markdown fences
    let analysisData;
    let cleanText = geminiResult.text.trim();
    if (cleanText.startsWith("```")) {
      cleanText = cleanText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    }

    try {
      analysisData = JSON.parse(cleanText);
    } catch (parseErr) {
      console.error(`[BiometricRoutes] AI returned invalid JSON. Using safe default.`);
      analysisData = {
        executive_summary: "Analysis completed. Please re-run for detailed report.",
        overall_score: 50,
        current_level: "Developing",
        key_strength: "Under Assessment",
        primary_focus: "Full analysis pending",
        growth_30_day: "First Assessment",
        radar_scores: { run_up_rhythm: 50, foot_placement: 50, body_turn_power: 50, straight_knee: 50, wrist_spin: 50, follow_through: 50 },
        issues: [],
        next_month_focus: ["Complete full biomechanical assessment"],
        parent_action: "Please ask the coach to schedule a full video analysis session.",
        expected_improvement_weeks: "TBD"
      };
    }

    // Add metadata to analysis
    analysisData.model_used   = geminiResult.modelUsed;
    analysisData.generated_at = new Date().toISOString();
    analysisData.persona_used = persona;

    // ─────────────────────────────────────────────────────────
    // SAVE TO DATABASE
    // Using ACTUAL column names from biomechanical_logs table:
    // kinematic_data_json = the full AI analysis JSON
    // ai_persona          = the persona used
    // ai_generated_report = text summary
    // generated_by_user_id = logged in user
    // snapshot_base64     = video frame snapshot
    // ─────────────────────────────────────────────────────────
    const insertResult = await pool.query(
      `INSERT INTO biomechanical_logs
        (player_id, generated_by_user_id, assessment_date,
         kinematic_data_json, ai_generated_report, ai_persona,
         snapshot_base64, status, created_at)
       VALUES ($1, $2, CURRENT_DATE, $3::jsonb, $4, $5, $6, 'complete', NOW())
       RETURNING id`,
      [
        player_id,
        user_id,
        JSON.stringify(analysisData),
        analysisData.executive_summary,
        persona,
        snapshot_base64 || null
      ]
    );

    const newRecordId = insertResult.rows[0].id;
    console.log(`[BiometricRoutes] Saved. Record ID: ${newRecordId}, Model: ${geminiResult.modelUsed}`);

    return res.status(200).json({
      success: true,
      record_id: newRecordId,
      player_id,
      model_used: geminiResult.modelUsed,
      used_fallback: geminiResult.usedFallback,
      message: "Analysis complete"
    });

  } catch (err) {
    console.error(`[BiometricRoutes] Error in /analyze: ${err.message}`);
    return res.status(500).json({
      error: "Analysis failed. Please try again.",
      detail: err.message
    });
  }
});

// ---------------------------------------------------------------
// GET /api/v1/biometrics/report/:player_id
// ---------------------------------------------------------------
router.get("/report/:player_id", authenticate, async (req, res) => {
  const { player_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, kinematic_data_json, ai_persona, created_at
       FROM biomechanical_logs
       WHERE player_id = $1
       ORDER BY created_at DESC
       LIMIT 5`,
      [player_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        error: "No reports found for this player",
        player_id
      });
    }

    // Find first valid non-corrupted record
    let validRecord = null;
    for (const row of result.rows) {
      const parsed = safeParseJSON(row.kinematic_data_json, row.id);
      if (parsed && !parsed._parse_error && parsed.overall_score !== undefined) {
        validRecord = {
          id: row.id,
          analysis_data: parsed,
          persona: row.ai_persona,
          created_at: row.created_at
        };
        break;
      }
      console.warn(`[BiometricRoutes] Skipping corrupted record ID ${row.id}`);
    }

    if (!validRecord) {
      return res.status(422).json({
        error: "all_records_corrupted",
        message: "All saved reports have corrupted data. Please run a new capture session.",
        player_id
      });
    }

    // Fetch player name
    const playerResult = await pool.query(
      "SELECT name, role FROM players WHERE id = $1",
      [player_id]
    );

    return res.status(200).json({
      success: true,
      player_name: playerResult.rows[0]?.name || "Player",
      player_role: playerResult.rows[0]?.role  || "Cricketer",
      record_id:   validRecord.id,
      created_at:  validRecord.created_at,
      persona:     validRecord.persona,
      analysis:    validRecord.analysis_data
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
// GET /api/v1/biometrics/history/:player_id
// ---------------------------------------------------------------
router.get("/history/:player_id", authenticate, async (req, res) => {
  const { player_id } = req.params;

  try {
    const result = await pool.query(
      `SELECT id, ai_persona, created_at,
              (kinematic_data_json->>'overall_score')::int as score,
              kinematic_data_json->>'current_level' as level
       FROM biomechanical_logs
       WHERE player_id = $1
       ORDER BY created_at DESC LIMIT 20`,
      [player_id]
    );
    return res.status(200).json({ success: true, history: result.rows });

  } catch (err) {
    console.error(`[BiometricRoutes] Error in GET /history/${player_id}: ${err.message}`);
    return res.status(500).json({ error: "Failed to load history" });
  }
});

module.exports = router;
