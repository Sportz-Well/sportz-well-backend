'use strict';

const { Pool } = require('pg');
const dotenv = require('dotenv');

dotenv.config();

function parseBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'y', 'on'].includes(normalized);
}

function useSsl() {
  if (process.env.DB_SSL !== undefined) return parseBool(process.env.DB_SSL, false);
  return process.env.NODE_ENV === 'production';
}

function buildPgConfig() {
  const ssl = useSsl() ? { rejectUnauthorized: false } : false;

  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5432),
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'postgres',
    ssl
  };
}

const pool = new Pool(buildPgConfig());

pool.on('error', (err) => {
  console.error('[db] Unexpected pool error:', err.message);
});

async function query(text, params = []) {
  return pool.query(text, params);
}

async function connect() {
  return pool.connect();
}

async function end() {
  return pool.end();
}

async function testConnection() {
  try {
    const result = await query('SELECT NOW() AS now');
    const sslStatus = useSsl() ? 'on' : 'off';
    console.log(`[db] Connected successfully | ssl=${sslStatus} | now=${result.rows[0].now}`);
  } catch (err) {
    console.error('[db] Connection failed:', err.message);
  }
}

if (process.env.NODE_ENV !== 'test') {
  testConnection();
}

// Export compatible object for all current usages
module.exports = {
  query,
  connect,
  end,
  pool
};
