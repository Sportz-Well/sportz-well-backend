'use strict';

// We import the actual connection pool from the config file
const pool = require('./config/db');

// Note: All database schema auto-patches and migrations have been 
// centralized in server.js to prevent schema drift and race conditions.

module.exports = {
  // A clean wrapper to execute queries
  query: (text, params) => pool.query(text, params),
  
  // Expose the raw client connection for advanced transactions
  connect: () => pool.connect(),
  
  // Expose the pool itself
  pool: pool
};