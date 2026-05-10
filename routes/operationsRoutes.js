'use strict';

const express = require('express');
const router = express.Router();
const db = require('../db');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const authenticate = require('../middleware/authMiddleware');

// Apply shared authentication middleware to all routes in this file
router.use(authenticate);

// ==========================================================
// COACH OPERATIONS
// ==========================================================

router.post('/attendance', async (req, res) => {
    const { date, attendance_data } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!date || !attendance_data || attendance_data.length === 0) {
        return res.status(400).json({ error: "Missing data." });
    }
    try {
        await db.query('BEGIN');
        for (const record of attendance_data) {
            await db.query(
                `INSERT INTO daily_attendance (player_id, school_id, date, status) VALUES ($1, $2, $3, $4)`,
                [record.player_id, secureAcademyId, date, record.status]
            );
        }
        await db.query('COMMIT');
        res.status(200).json({ message: "Attendance saved!" });
    } catch (err) {
        await db.query('ROLLBACK');
        res.status(500).json({ error: "Failed to save attendance." });
    }
});

router.post('/weekly-assessment', async (req, res) => {
    const { player_id, assessment_date, physical_score, technical_score, mental_score } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !assessment_date) {
        return res.status(400).json({ error: "Missing data." });
    }
    try {
        await db.query(
            `INSERT INTO weekly_assessments (player_id, school_id, assessment_date, physical_score, technical_score, mental_score) VALUES ($1, $2, $3, $4, $5, $6)`,
            [player_id, secureAcademyId, assessment_date, physical_score, technical_score, mental_score]
        );
        res.status(200).json({ message: "Assessment saved!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save assessment." });
    }
});

router.post('/match-log', async (req, res) => {
    const { player_id, match_date, tournament_name, runs, balls_faced, fours, sixes, not_out, overs_bowled, wickets, runs_conceded, catches, stumpings, run_outs } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !match_date) {
        return res.status(400).json({ error: "Missing match data." });
    }
    try {
        await db.query(
            `INSERT INTO match_logs (player_id, school_id, match_date, tournament_name, runs, balls_faced, fours, sixes, not_out, overs_bowled, wickets, runs_conceded, catches, stumpings, run_outs) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
            [player_id, secureAcademyId, match_date, tournament_name, runs || 0, balls_faced || 0, fours || 0, sixes || 0, not_out || false, overs_bowled || 0, wickets || 0, runs_conceded || 0, catches || 0, stumpings || 0, run_outs || 0]
        );
        res.status(200).json({ message: "Match logged!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to log match." });
    }
});

router.post('/coach-remarks', async (req, res) => {
    const { player_id, remark_date, notes } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !remark_date || !notes) {
        return res.status(400).json({ error: "Missing remark data." });
    }
    try {
        await db.query(
            `INSERT INTO coach_remarks (player_id, school_id, remark_date, notes) VALUES ($1, $2, $3, $4)`,
            [player_id, secureAcademyId, remark_date, notes]
        );
        res.status(200).json({ message: "Remark saved!" });
    } catch (err) {
        res.status(500).json({ error: "Failed to save remark." });
    }
});

router.post('/video-log', async (req, res) => {
    const { player_id, upload_date, video_url, technical_notes } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !upload_date || !video_url) {
        return res.status(400).json({ error: "Missing required video data." });
    }
    try {
        await db.query(
            `INSERT INTO video_logs (player_id, school_id, upload_date, video_url, technical_notes) VALUES ($1, $2, $3, $4, $5)`,
            [player_id, secureAcademyId, upload_date, video_url, technical_notes]
        );
        res.status(200).json({ message: "Video analysis saved successfully!" });
    } catch (err) {
        console.error("Database Error saving video log:", err);
        res.status(500).json({ error: "Failed to log video." });
    }
});

// ==========================================================
// AI REPORT GENERATION (Legacy - kept for reference)
// ==========================================================

const delay = ms => new Promise(res => setTimeout(res, ms));

router.post('/generate-ai-report', async (req, res) => {
    const { player_id } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id) return res.status(400).json({ error: "Missing player_id" });

    try {
        const playerRes = await db.query(
            'SELECT name FROM players WHERE id = $1 AND academy_id = $2',
            [player_id, secureAcademyId]
        );
        if (playerRes.rows.length === 0) {
            return res.status(403).json({ error: "Access denied or Player not found." });
        }
        const player = playerRes.rows[0];

        const matchesRes = await db.query(
            'SELECT * FROM match_logs WHERE player_id = $1 ORDER BY match_date DESC LIMIT 10',
            [player_id]
        );
        const matches = matchesRes.rows;

        const remarksRes = await db.query(
            'SELECT notes FROM coach_remarks WHERE player_id = $1 ORDER BY remark_date DESC LIMIT 5',
            [player_id]
        );
        const coachNotes = remarksRes.rows.map(r => r.notes).join(' | ');

        let totalRuns = 0; let dismissals = 0; let totalRunsConceded = 0; let totalOvers = 0; let totalWickets = 0;

        matches.forEach(m => {
            totalRuns += Number(m.runs || 0);
            if (!m.not_out) dismissals += 1;
            totalRunsConceded += Number(m.runs_conceded || 0);
            totalOvers += Number(m.overs_bowled || 0);
            totalWickets += Number(m.wickets || 0);
        });

        const batAvg = dismissals > 0 ? (totalRuns / dismissals).toFixed(2) : (totalRuns > 0 ? `${totalRuns} (Undefeated)` : "0.00");
        const ecoRate = totalOvers > 0 ? (totalRunsConceded / totalOvers).toFixed(2) : "0.00";

        const prompt = `
        You are an elite cricket high-performance coach writing a monthly report for the parents of ${player.name}.
        Hard Data (Last ${matches.length} matches):
        - Batting Average: ${batAvg}
        - Bowling Economy Rate: ${ecoRate}
        - Total Wickets: ${totalWickets}
        Coach's Subjective Remarks: "${coachNotes || 'No recent remarks.'}"
        Write a professional, encouraging 3-paragraph report.
        Paragraph 1: Summarize their statistical match form.
        Paragraph 2: Sentiment analysis on coach remarks regarding mental focus and technique.
        Paragraph 3: Specific 3-step Action Plan of drills for next month.
        Do not use markdown. Plain text with line breaks only.
        `;

        let attempt = 0;
        const maxAttempts = 3;
        let aiReportText = "";
        let aiSuccess = false;
        let lastError = null;

        while (attempt < maxAttempts && !aiSuccess) {
            try {
                const currentModelName = (attempt === maxAttempts - 1) ? "gemini-2.5-flash-lite" : "gemini-2.5-flash";
                const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
                const model = genAI.getGenerativeModel({ model: currentModelName });
                const result = await model.generateContent(prompt);
                if (!result || !result.response) throw new Error("Empty AI response.");
                aiReportText = result.response.text();
                aiSuccess = true;
            } catch (err) {
                lastError = err;
                attempt++;
                if (attempt < maxAttempts) {
                    const waitTime = Math.pow(2, attempt) * 1000;
                    await delay(waitTime);
                }
            }
        }

        if (!aiSuccess) throw lastError;

        res.status(200).json({
            success: true,
            player_name: player.name,
            calculated_stats: { batAvg, ecoRate, totalWickets, matches_played: matches.length },
            ai_report: aiReportText
        });

    } catch (err) {
        console.error("AI Gen Error:", err);
        res.status(500).json({ error: "AI Error: " + err.message });
    }
});

// ==========================================================
// MONTHLY REPORT GENERATION (All 4 Sources — No AI)
// ==========================================================

router.post('/generate-monthly-report', async (req, res) => {
    const { player_id, month, year } = req.body;
    const secureAcademyId = req.user.academy_id;

    if (!player_id || !month || !year) {
        return res.status(400).json({ error: "Missing player_id, month, or year." });
    }

    try {
        // STEP 1: Verify player belongs to this academy
        const playerRes = await db.query(
            `SELECT id, name, role FROM players WHERE id = $1 AND academy_id = $2`,
            [player_id, secureAcademyId]
        );
        if (playerRes.rows.length === 0) {
            return res.status(403).json({ error: "Player not found in your academy." });
        }
        const player = playerRes.rows[0];

        // STEP 2: Check if report already generated this month
        const existingReport = await db.query(
            `SELECT id FROM generated_reports WHERE player_id = $1 AND report_month = $2 AND report_year = $3 AND academy_id = $4`,
            [player_id, month, year, secureAcademyId]
        );
        if (existingReport.rows.length > 0) {
            return res.status(409).json({
                error: "Report already generated for this player this month. Use the previously saved PDF."
            });
        }

        // STEP 3: Attendance for the month
        const attendanceRes = await db.query(
            `SELECT status FROM daily_attendance WHERE player_id = $1 AND EXTRACT(MONTH FROM date) = $2 AND EXTRACT(YEAR FROM date) = $3`,
            [player_id, month, year]
        );
        const totalSessions = attendanceRes.rows.length;
        const presentCount = attendanceRes.rows.filter(r => r.status === 'Present').length;
        const attendancePct = totalSessions > 0 ? Math.round((presentCount / totalSessions) * 100) : 0;

        // STEP 4: Weekly assessments for the month
        const assessmentRes = await db.query(
            `SELECT physical_score, technical_score, mental_score, match_score, assessment_date FROM weekly_assessments WHERE player_id = $1 AND EXTRACT(MONTH FROM assessment_date) = $2 AND EXTRACT(YEAR FROM assessment_date) = $3 ORDER BY assessment_date ASC`,
            [player_id, month, year]
        );
        const assessments = assessmentRes.rows;
        let avgPhysical = 0, avgTechnical = 0, avgMental = 0;
        const weeklyScores = [];

        if (assessments.length > 0) {
            assessments.forEach(a => {
                avgPhysical  += Number(a.physical_score  || 0);
                avgTechnical += Number(a.technical_score || 0);
                avgMental    += Number(a.mental_score    || 0);
                const weekAvg = ((Number(a.physical_score || 0) + Number(a.technical_score || 0) + Number(a.mental_score || 0)) / 3).toFixed(1);
                weeklyScores.push(Number(weekAvg));
            });
            avgPhysical  = (avgPhysical  / assessments.length).toFixed(1);
            avgTechnical = (avgTechnical / assessments.length).toFixed(1);
            avgMental    = (avgMental    / assessments.length).toFixed(1);
        }
        const overallScore = assessments.length > 0
            ? ((Number(avgPhysical) + Number(avgTechnical) + Number(avgMental)) / 3).toFixed(1)
            : 0;

        // STEP 5: Match data for the month
        const matchRes = await db.query(
            `SELECT runs, balls_faced, fours, sixes, not_out, overs_bowled, wickets, runs_conceded, tournament_name FROM match_logs WHERE player_id = $1 AND EXTRACT(MONTH FROM match_date) = $2 AND EXTRACT(YEAR FROM match_date) = $3`,
            [player_id, month, year]
        );
        const matches = matchRes.rows;
        let totalRuns = 0, highestScore = 0, totalWickets = 0, dismissals = 0;
        matches.forEach(m => {
            totalRuns    += Number(m.runs || 0);
            totalWickets += Number(m.wickets || 0);
            if (Number(m.runs) > highestScore) highestScore = Number(m.runs);
            if (!m.not_out) dismissals++;
        });
        const battingAvg = dismissals > 0 ? (totalRuns / dismissals).toFixed(1) : totalRuns > 0 ? `${totalRuns}*` : "0";

        // STEP 6: Coach remarks for the month
        const remarksRes = await db.query(
            `SELECT notes, remark_date FROM coach_remarks WHERE player_id = $1 AND EXTRACT(MONTH FROM remark_date) = $2 AND EXTRACT(YEAR FROM remark_date) = $3 ORDER BY remark_date DESC`,
            [player_id, month, year]
        );
        const latestRemark = remarksRes.rows.length > 0 ? remarksRes.rows[0].notes : "No remarks recorded this month.";

        // STEP 7: Record report as generated to block duplicates
        await db.query(
            `INSERT INTO generated_reports (player_id, academy_id, report_month, report_year, generated_at) VALUES ($1, $2, $3, $4, NOW())`,
            [player_id, secureAcademyId, month, year]
        );

        // STEP 8: Return all data to frontend
        res.status(200).json({
            success: true,
            player: { id: player.id, name: player.name, role: player.role },
            report_period: { month, year },
            attendance: { percentage: attendancePct, present: presentCount, total: totalSessions },
            assessments: {
                overall_score: overallScore,
                avg_physical: avgPhysical,
                avg_technical: avgTechnical,
                avg_mental: avgMental,
                weekly_trend: weeklyScores
            },
            matches: {
                total_runs: totalRuns,
                highest_score: highestScore,
                batting_avg: battingAvg,
                total_wickets: totalWickets,
                matches_played: matches.length
            },
            coach_remarks: latestRemark
        });

    } catch (err) {
        console.error("Monthly Report Error:", err);
        res.status(500).json({ error: "Failed to generate report: " + err.message });
    }
});

module.exports = router;