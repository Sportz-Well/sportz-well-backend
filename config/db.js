'use strict';

require('dotenv').config();
const { Pool } = require('pg');

// ==========================================================
// ENTERPRISE DATABASE CONNECTION POOL
// ==========================================================
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Render/managed cloud databases
  },
  // CTO FIX: Explicit load-balancing limits
  max: 20,                      // Max number of active connections in the pool (safe for Render standard tiers)
  idleTimeoutMillis: 30000,     // Close idle connections after 30 seconds to free up RAM
  connectionTimeoutMillis: 5000 // Return an error after 5 seconds if DB is unreachable (prevents app freezing)
});

// Failsafe: Catch unexpected errors on idle clients so they don't silently crash the server
pool.on('error', (err, client) => {
  console.error('❌ Critical: Unexpected error on idle database client', err);
  // We do not process.exit() here because we want the pool to self-heal, 
  // but we must log it for monitoring.
});

pool.connect()
  .then(() => console.log("✅ Connected to Render PostgreSQL (Enterprise Pool Active)"))
  .catch(err => console.error("❌ DB Connection Fatal Error:", err.message));

module.exports = pool;