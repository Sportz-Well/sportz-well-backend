// patch_db_snapshot.js
// SWPI Automated DB Patch Script
require('dotenv').config(); 
const { Client } = require('pg');

const patchTable = async () => {
    const client = new Client({
        connectionString: process.env.DATABASE_URL, 
        ssl: { rejectUnauthorized: false }
    });

    // Alter the existing table to add the new image storage column
    const query = `ALTER TABLE biomechanical_logs ADD COLUMN IF NOT EXISTS snapshot_base64 TEXT;`;

    try {
        console.log("Connecting to Render PostgreSQL...");
        await client.connect();
        await client.query(query);
        console.log("✅ SUCCESS: Added 'snapshot_base64' column to biomechanical_logs.");
    } catch (err) {
        console.error("❌ FATAL ERROR:", err.message);
    } finally {
        await client.end();
        process.exit();
    }
};

patchTable();