// =============================================================
// geminiService.js — SWPI Gemini Fallback Chain
// LOCATION: root of CRICKET-MVP-BACKEND (same level as server.js)
// =============================================================
//
// COMMIT MESSAGE:
// fix: geminiService.js — update Gemini model names to correct
// working API versions, fixes 404 model not found errors
//
// =============================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// FIXED model names — these are the correct working API identifiers
const MODEL_PRIMARY   = "gemini-1.5-pro";    // Best quality, stable
const MODEL_SECONDARY = "gemini-1.5-flash";   // Fast fallback

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
        // Non-retryable error — throw immediately
        console.error(`[GeminiService] Non-retryable error on ${modelName}: ${err.message}`);
        throw err;
      }
    }
  }
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
      so_what: "No data lost. Return to Video Analysis and run again."
    }],
    next_month_focus: ["Re-run biomechanical capture session"],
    parent_action: "Please ask the coach to schedule a new video analysis session.",
    expected_improvement_weeks: "TBD",
    model_used: "safe_default",
    generated_at: new Date().toISOString()
  });
}

async function callGeminiWithFallback(prompt) {
  // Step 1: Try primary model
  try {
    const text = await callModelWithRetry(MODEL_PRIMARY, prompt, MAX_RETRIES);
    return { text, modelUsed: MODEL_PRIMARY, usedFallback: false };
  } catch (primaryErr) {
    console.warn(`[GeminiService] Primary model failed. Switching to fallback...`);
  }

  // Step 2: Try secondary model
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

module.exports = { callGeminiWithFallback };
