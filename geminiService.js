// =============================================================
// geminiService.js
// LOCATION: root of CRICKET-MVP-BACKEND (same level as server.js)
// =============================================================
//
// COMMIT MESSAGE:
// fix: geminiService.js — correct persona prompt descriptions,
// The Master now focuses on batting not bowling
//
// =============================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Confirmed working models from API key (verified May 2026)
const MODEL_PRIMARY   = "gemini-2.5-flash";
const MODEL_SECONDARY = "gemini-2.0-flash";

const MAX_RETRIES   = 3;
const BASE_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callModelWithRetry(modelName, prompt, maxRetries) {
  const model = genAI.getGenerativeModel({ model: modelName });

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`[GeminiService] Trying ${modelName} — Attempt ${attempt}/${maxRetries}`);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      console.log(`[GeminiService] SUCCESS with ${modelName} on attempt ${attempt}`);
      return text;

    } catch (err) {
      const is503 = err.message && (
        err.message.includes("503") ||
        err.message.includes("Service Unavailable") ||
        err.message.includes("high demand") ||
        err.message.includes("overloaded")
      );
      const isLast = attempt === maxRetries;

      if (isLast) {
        console.error(`[GeminiService] FAILED: ${modelName} exhausted all retries. Error: ${err.message}`);
        throw err;
      }

      if (is503) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[GeminiService] ${modelName} busy. Waiting ${waitMs}ms...`);
        await sleep(waitMs);
      } else {
        console.error(`[GeminiService] Non-retryable error on ${modelName}: ${err.message}`);
        throw err;
      }
    }
  }
}

// ---------------------------------------------------------------
// PERSONA PROMPTS — each one tells Gemini what role it is playing
// and exactly what to focus on for that discipline
// ---------------------------------------------------------------
const PERSONA_PROMPTS = {

  "The Master (Batting)": `You are 'The Master' — a world-class batting coach and biomechanics expert.
Your entire focus is on BATTING technique only.
Analyse: head position and stillness, backlift height and direction, weight transfer onto the front foot, 
elbow position in the drive, bat swing path through the line of the ball, balance at the crease, 
footwork to both pace and spin, and follow-through direction.
Do NOT mention bowling, run-up, or delivery mechanics in any part of your analysis.`,

  "The Sultan (Pace)": `You are 'The Sultan' — an elite fast bowling coach and biomechanics expert.
Your entire focus is on PACE BOWLING technique only.
Analyse: run-up rhythm and acceleration, bound and gather, front arm drive, bowling shoulder position,
wrist position at release, seam presentation, follow-through arc, and back foot landing position.
Do NOT mention batting technique in any part of your analysis.`,

  "The Magician (Spin)": `You are 'The Magician' — a specialist spin bowling coach and biomechanics expert.
Your entire focus is on SPIN BOWLING technique only.
Analyse: run-up rhythm and approach angle, front foot landing direction and alignment, 
body turn and hip-shoulder separation, wrist position and finger spin at release, 
follow-through, and overall body balance through the delivery stride.
Do NOT mention batting technique or pace bowling in any part of your analysis.`,

  "The Keeper (Wicket)": `You are 'The Keeper' — a wicket-keeping and agility specialist coach.
Your entire focus is on WICKET KEEPING technique only.
Analyse: stance width and depth behind the stumps, glove position and soft hands at take,
footwork movement to leg side and off side, body position when taking the ball, 
catching technique for high catches, and stumping movement speed.
Do NOT mention batting or bowling technique in any part of your analysis.`

};

// ---------------------------------------------------------------
// BUILD FULL PROMPT for Gemini
// ---------------------------------------------------------------
function buildPrompt(playerName, playerRole, coachObservations, persona) {
  const personaText = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS["The Master (Batting)"];

  return `${personaText}

You are generating a structured biomechanical report for a grassroots cricket player.
Player Name: ${playerName}
Playing Role: ${playerRole || "Cricketer"}
Coach Observations and Kinematic Data: ${coachObservations}

CRITICAL INSTRUCTION: Respond with ONLY a valid JSON object. 
No preamble. No explanation. No markdown. No backticks. 
Start your response with { and end with }. Nothing else.

Required JSON structure — fill every field based on the player's BATTING technique only:
{
  "executive_summary": "One sentence plain-English summary for parents about this player's technique",
  "overall_score": <number 0-100>,
  "current_level": "<Elite / Advanced / Developing / Beginner>",
  "key_strength": "<one short phrase about their biggest strength>",
  "primary_focus": "<one short phrase about the single most important thing to improve>",
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
      "title": "<short descriptive title of the issue>",
      "observation": "<what the coach or camera observes happening>",
      "mechanic": "<the biomechanical explanation of why this is happening>",
      "so_what": "<plain English explanation for parents of why this matters>"
    }
  ],
  "next_month_focus": [
    "<specific drill or focus area 1>",
    "<specific drill or focus area 2>",
    "<specific drill or focus area 3>"
  ],
  "parent_action": "<one specific action parents can take at home to support improvement>",
  "expected_improvement_weeks": "<realistic timeframe e.g. 4-6>"
}`;
}

function buildSafeDefaultReport() {
  return JSON.stringify({
    executive_summary: "AI analysis is temporarily unavailable. Please re-run the analysis session.",
    overall_score: 50,
    current_level: "Analysis Pending",
    key_strength: "To be determined",
    primary_focus: "Re-run capture session",
    growth_30_day: "N/A",
    radar_scores: {
      run_up_rhythm: 50, foot_placement: 50, body_turn_power: 50,
      straight_knee: 50, wrist_spin: 50, follow_through: 50
    },
    issues: [{
      severity: "info",
      title: "Analysis Pending",
      observation: "The AI engine was temporarily unavailable.",
      mechanic: "Please run a new capture session.",
      so_what: "No data has been lost. Return to Video Analysis and run again."
    }],
    next_month_focus: ["Re-run biomechanical capture session"],
    parent_action: "Please ask the coach to schedule a new video analysis session.",
    expected_improvement_weeks: "TBD",
    model_used: "safe_default",
    generated_at: new Date().toISOString()
  });
}

// ---------------------------------------------------------------
// MAIN EXPORT
// Call this from biometricRoutes.js
// ---------------------------------------------------------------
async function callGeminiWithFallback(prompt) {
  // Step 1: Try primary model
  try {
    const text = await callModelWithRetry(MODEL_PRIMARY, prompt, MAX_RETRIES);
    return { text, modelUsed: MODEL_PRIMARY, usedFallback: false };
  } catch (primaryErr) {
    console.warn(`[GeminiService] Primary model failed. Switching to fallback...`);
  }

  // Step 2: Try fallback model
  try {
    const text = await callModelWithRetry(MODEL_SECONDARY, prompt, MAX_RETRIES);
    return { text, modelUsed: MODEL_SECONDARY, usedFallback: true };
  } catch (secondaryErr) {
    console.error(`[GeminiService] ALL models failed. Returning safe default.`);
  }

  // Step 3: Safe default — app never crashes
  return {
    text: buildSafeDefaultReport(),
    modelUsed: "safe_default",
    usedFallback: true,
    isDefault: true
  };
}

// Export both functions so biometricRoutes can use buildPrompt directly
module.exports = { callGeminiWithFallback, buildPrompt };
