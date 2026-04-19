'use strict';
require('dotenv').config();
const { Client } = require('pg'); // We are using the VIP Messenger (Client) now

// Secure, direct connection forcing the guard to keep the door open
const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    keepAlive: true,
    statement_timeout: 30000 
});

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

async function upgradeDatabase() {
    console.log("🚀 Initiating Direct Client Database Upgrade...");
    
    try {
        await client.connect(); 
        console.log("🟢 Direct connection established with Render.");

        // Phase 1: Daily Attendance
        console.log("⏳ Phase 1: Creating daily_attendance...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS daily_attendance (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                school_id VARCHAR(255) NOT NULL,
                date DATE NOT NULL,
                status VARCHAR(20) CHECK (status IN ('Present', 'Absent', 'Late', 'Excused')),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Phase 1 Complete.");
        await sleep(1000); 

        // Phase 2: Weekly Assessments
        console.log("⏳ Phase 2: Creating weekly_assessments...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS weekly_assessments (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                school_id VARCHAR(255) NOT NULL,
                assessment_date DATE NOT NULL,
                physical_score NUMERIC(4,2) CHECK (physical_score >= 1 AND physical_score <= 10),
                technical_score NUMERIC(4,2) CHECK (technical_score >= 1 AND technical_score <= 10),
                mental_score NUMERIC(4,2) CHECK (mental_score >= 1 AND mental_score <= 10),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Phase 2 Complete.");
        await sleep(1000);

        // Phase 3: Match Logs
        console.log("⏳ Phase 3: Creating match_logs...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS match_logs (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                school_id VARCHAR(255) NOT NULL,
                match_date DATE NOT NULL,
                tournament_name VARCHAR(255),
                runs INTEGER DEFAULT 0,
                balls_faced INTEGER DEFAULT 0,
                fours INTEGER DEFAULT 0,
                sixes INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Phase 3 Complete.");
        await sleep(1000);

        // Phase 4: Coach Remarks
        console.log("⏳ Phase 4: Creating coach_remarks...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS coach_remarks (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                coach_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                school_id VARCHAR(255) NOT NULL,
                remark_date DATE NOT NULL,
                notes TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        console.log("✅ Phase 4 Complete.");
        await sleep(1000);

        // Phase 5: Monthly Reports & Indexes
        console.log("⏳ Phase 5: Creating monthly_reports & Indexes...");
        await client.query(`
            CREATE TABLE IF NOT EXISTS monthly_reports (
                id SERIAL PRIMARY KEY,
                player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
                school_id VARCHAR(255) NOT NULL,
                report_month VARCHAR(20) NOT NULL,
                frozen_data JSONB NOT NULL,
                delta_progress TEXT,
                shared_date TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        `);
        
        await client.query(`CREATE INDEX IF NOT EXISTS idx_attendance_school_player ON daily_attendance(school_id, player_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_weekly_school_player ON weekly_assessments(school_id, player_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_match_school_player ON match_logs(school_id, player_id);`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_monthly_reports_school ON monthly_reports(school_id, player_id);`);
        
        console.log("✅ Phase 5 Complete.");
        console.log("🎉 ALL TABLES CREATED SUCCESSFULLY!");

    } catch (err) {
        console.error("❌ ERROR:", err.message);
    } finally {
        await client.end(); // Cleanly close the door when we are done
        process.exit();
    }
}

upgradeDatabase();