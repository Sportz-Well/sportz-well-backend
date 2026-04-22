'use strict';
const express = require('express');
const router = express.Router();
const pool = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');

// The Core Intellectual Property (IP) - The Expert Personas
const PERSONA_PROMPTS = {
    sachin: `You are an elite cricket biomechanics expert analyzing a batter, adopting the analytical mindset of Sachin Tendulkar. Focus heavily on balance, head position, still foundation, footwork, and playing late. Keep the tone professional, encouraging, and highly technical.`,
    wasim: `You are an elite cricket biomechanics expert analyzing a pace bowler, adopting the analytical mindset of Wasim Akram. Focus heavily on wrist position, run-up rhythm, arm speed, seam presentation, and follow-through. Keep the tone professional, encouraging, and highly technical.`,
    warne: `You are an elite cricket biomechanics expert analyzing a spin bowler, adopting the analytical mindset of Shane Warne. Focus heavily on revolutions on the ball, drift, dip, body alignment, and tactical deception. Keep the tone professional, encouraging, and highly technical.`,
    gilchrist: `You are an elite cricket biomechanics expert analyzing a wicketkeeper, adopting the analytical mindset of Adam Gilchrist. Focus heavily on footwork, soft hands, posture, agility, and head position. Keep the tone professional, encouraging, and highly technical.`
};

router.post('/', async (req, res) => {
    try {
        const { player_id, video_link, raw_notes, persona, school_id } = req.body;

        // 1. Verify Player & Access
        const playerRes = await pool.query('SELECT * FROM players WHERE id = $1 AND (academy_id = $2 OR school_id = $2)', [player_id, school_id]);
        if (playerRes.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Player not found or access denied.' });
        }
        const player = playerRes.rows[0];

        // 2. Prepare the AI Prompt
        const systemInstruction = PERSONA_PROMPTS[persona] || PERSONA_PROMPTS['sachin'];
        const prompt = `
        Analyze the following player based on the coach's raw observations.
        Player Name: ${player.name}
        Player Role: ${player.role}
        Video Reference: ${video_link}
        Coach's Raw Notes:
        ${raw_notes}

        You MUST return a STRICT JSON object using exactly this structure, with no markdown formatting outside the JSON. Do not include markdown code block backticks (e.g. \`\`\`json).
        {
          "executive_summary": "A 2-sentence encouraging but analytical summary.",
          "overall_score": 75,
          "radar_chart": {
            "labels": ["Metric 1", "Metric 2", "Metric 3", "Metric 4", "Metric 5", "Metric 6"],
            "data": [80, 60, 70, 90, 85, 65]
          },
          "issues": [
            {
              "title": "Short title of the technical issue",
              "severity": "high", 
              "observation": "What the coach saw",
              "mechanic": "The biomechanical reason for this issue",
              "so_what": "The real-world consequence in a match if not fixed"
            },
            {
              "title": "Short title of the second technical issue",
              "severity": "med", 
              "observation": "What the coach saw",
              "mechanic": "The biomechanical reason for this issue",
              "so_what": "The real-world consequence in a match if not fixed"
            }
          ],
          "next_month_targets": {
            "focus": "Main technical focus",
            "improve": "What this will improve",
            "target": "The specific physical target"
          },
          "parent_action": "One specific drill or action for parents to help with at home",
          "timeline": "e.g., 4-6 Weeks"
        }
        `;

        // 3. Fire the API Call to Google Gemini using the existing correct package
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const model = genAI.getGenerativeModel({ 
            model: "gemini-2.5-flash",
            systemInstruction: systemInstruction 
        });

        const result = await model.generateContent(prompt);
        let textResponse = result.response.text();
        
        // Strip out any accidental markdown formatting the AI might add
        textResponse = textResponse.replace(/```json/g, '').replace(/```/g, '').trim();

        const reportData = JSON.parse(textResponse);

        // Send the JSON report back to the frontend
        res.json({ success: true, report: reportData, player: player });

    } catch (err) {
        console.error('Video Analysis Error:', err);
        res.status(500).json({ success: false, message: 'Failed to generate AI report.' });
    }
});

module.exports = router;