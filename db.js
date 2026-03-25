'use strict';

const pool = require('./config/db');

/**
 * Startup Patch: Runs right after connecting
 */
async function runStartupPatch() {
  try {
    const patchSql = `
      ALTER TABLE players 
      ADD COLUMN IF NOT EXISTS school_id INTEGER DEFAULT 1, 
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS school_id_no VARCHAR,
      ADD COLUMN IF NOT EXISTS aadhaar_card_no VARCHAR,
      ADD COLUMN IF NOT EXISTS gender VARCHAR,
      ADD COLUMN IF NOT EXISTS age INTEGER,
      ADD COLUMN IF NOT EXISTS std VARCHAR,
      ADD COLUMN IF NOT EXISTS div VARCHAR,
      ADD COLUMN IF NOT EXISTS role VARCHAR;
    `;
    await pool.query(patchSql);
    console.log('✅ Startup patch applied: All columns verified on players table.');
  } catch (err) {
    console.error('❌ Startup patch failed:', err.message);
  }
}

// Execute patch (this will run when root db.js is first required)
runStartupPatch();

module.exports = {
  query: (text, params) => pool.query(text, params),
  connect: () => pool.connect(),
  pool: pool
};
