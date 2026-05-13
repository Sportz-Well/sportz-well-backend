// =============================================================
// geminiService.js — SWPI Gemini Fallback Chain
// =============================================================
// HOW IT WORKS (plain English):
// This file is like a smart taxi dispatcher.
// Step 1: It always tries Gemini 2.5 Flash first (best quality).
// Step 2: If Gemini 2.5 Flash is busy (503 error), it 
//         automatically switches to Gemini 1.5 Flash (reliable).
// Step 3: If both fail, it returns a safe default report so
//         the app never crashes and the coach never sees an error.
// You never need to change your other code — just call
// callGeminiWithFallback() instead of the direct API call.
// =============================================================

const { GoogleGenerativeAI } = require("@google/generative-ai");

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// The two models in priority order
const MODEL_PRIMARY   = "gemini-2.5-flash-preview-05-20"; // Best quality
const MODEL_SECONDARY = "gemini-1.5-flash";               // Reliable fallback

// How many times to retry each model before giving up
const MAX_RETRIES = 3;

// How long to wait between retries (in milliseconds)
// 1500ms, 3000ms, 6000ms — each wait doubles (exponential backoff)
const BASE_DELAY_MS = 1500;

// ---------------------------------------------------------------
// Internal helper: pause for a given number of milliseconds
// ---------------------------------------------------------------
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------
// Internal helper: call ONE specific model with retry logic
// Returns the text response, or throws if all retries fail
// ---------------------------------------------------------------
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
        // All retries exhausted for this model
        console.error(`[GeminiService] FAILED: ${modelName} exhausted all ${maxRetries} attempts. Last error: ${err.message}`);
        throw err; // Bubble up so the caller can try the next model
      }

      if (is503) {
        const waitMs = BASE_DELAY_MS * Math.pow(2, attempt - 1);
        console.warn(`[GeminiService] ${modelName} busy (503). Waiting ${waitMs}ms before retry...`);
        await sleep(waitMs);
      } else {
        // Non-503 error (e.g. bad API key, invalid prompt) — no point retrying
        console.error(`[GeminiService] Non-retryable error on ${modelName}: ${err.message}`);
        throw err;
      }
    }
  }
}

// ---------------------------------------------------------------
// Internal helper: build a safe default report when ALL AI fails
// This ensures the report page always loads — never crashes
// ---------------------------------------------------------------
function buildSafeDefaultReport(playerName) {
  return {
    executive_summary: "AI analysis is temporarily unavailable. Please re-run the analysis session.",
    overall_score: 50,
    current_level: "Analysis Pending",
    key_strength: "To be determined",
    primary_focus: "To be determined",
    growth_30_day: "N/A",
    radar_scores: {
      run_up_rhythm: 50,
      foot_placement: 50,
      body_turn_power: 50,
      straight_knee: 50,
      wrist_spin: 50,
      follow_through: 50
    },
    issues: [
      {
        severity: "info",
        title: "Analysis Pending",
        observation: "The AI engine was temporarily unavailable during this session.",
        mechanic: "Please run a new capture session to generate the full biomechanical report.",
        so_what: "No data has been lost. Simply return to Video Analysis and run again."
      }
    ],
    next_month_focus: ["Re-run biomechanical capture session"],
    parent_action: "Please ask the coach to schedule a new video analysis session.",
    expected_improvement_weeks: "TBD",
    model_used: "fallback_default",
    generated_at: new Date().toISOString()
  };
}

// ---------------------------------------------------------------
// MAIN EXPORT — This is the only function you call from your routes
//
// Usage:
//   const { callGeminiWithFallback } = require('./geminiService');
//   const result = await callGeminiWithFallback(prompt, playerName);
//   // result.text     — the raw AI text response
//   // result.modelUsed — which model actually responded
//   // result.usedFallback — true if 1.5 Flash was used
// ---------------------------------------------------------------
async function callGeminiWithFallback(prompt, playerName = "Player") {
  
  // STEP 1: Try primary model (Gemini 2.5 Flash)
  try {
    const text = await callModelWithRetry(MODEL_PRIMARY, prompt, MAX_RETRIES);
    return {
      text,
      modelUsed: MODEL_PRIMARY,
      usedFallback: false
    };
  } catch (primaryErr) {
    console.warn(`[GeminiService] Primary model failed. Switching to fallback model...`);
  }

  // STEP 2: Try secondary model (Gemini 1.5 Flash)
  try {
    const text = await callModelWithRetry(MODEL_SECONDARY, prompt, MAX_RETRIES);
    return {
      text,
      modelUsed: MODEL_SECONDARY,
      usedFallback: true
    };
  } catch (secondaryErr) {
    console.error(`[GeminiService] ALL models failed. Returning safe default report.`);
  }

  // STEP 3: Both failed — return safe default so app never crashes
  const defaultData = buildSafeDefaultReport(playerName);
  return {
    text: JSON.stringify(defaultData),
    modelUsed: "safe_default",
    usedFallback: true,
    isDefault: true
  };
}

module.exports = { callGeminiWithFallback };
