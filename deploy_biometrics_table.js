// deploy_biometrics_table.js
// SWPI Automated DB Deployment Script - V2 (Self-Contained SSL Client)
require('dotenv').config(); 
const { Client } = require('pg');

const deployTable = async () => {
    // Create a dedicated client just for this script, enforcing SSL for Render
    const client = new Client({
        connectionString: process.env.DATABASE_URL, 
        ssl: {
            rejectUnauthorized: false // Strictly required for external connections to Render
        }
    });

    const query = `
        CREATE TABLE IF NOT EXISTS biomechanical_logs (
            id SERIAL PRIMARY KEY,
            player_id INT REFERENCES players(id),
            generated_by_user_id INT REFERENCES users(id), 
            assessment_date DATE NOT NULL,
            ai_persona VARCHAR(50) NOT NULL, 
            kinematic_data_json JSONB NOT NULL, 
            ai_generated_report TEXT, 
            status VARCHAR(20) DEFAULT 'Data_Captured', 
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
    `;

    try {
        console.log("Attempting to connect to the Render PostgreSQL database securely...");
        await client.connect();
        console.log("Connection established. Executing query...");
        
        await client.query(query);
        
        console.log("✅ SUCCESS: The 'biomechanical_logs' table has been safely deployed to Render.");
        console.log("You can now safely close this script.");
    } catch (err) {
        console.error("❌ FATAL ERROR: Failed to create the table.");
        console.error(err.message);
    } finally {
        // Safely disconnect
        await client.end();
        process.exit();
    }
};

deployTable();