'use strict';

const express = require('express');
const db = require('../db');

const router = express.Router();

// OPTIONAL: basic protection (safe for now)
function requireResetAuthorization(req, res, next) {
  const configuredKey = process.env.ADMIN_RESET_KEY;

  if (!configuredKey) {
    return next(); // allow for demo
  }

  const providedKey =
    req.headers['x-admin-reset-key'] ||
    req.query.resetKey ||
    (req.body && req.body.resetKey);

  if (String(providedKey || '') !== String(configuredKey)) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized reset request'
    });
  }

  next();
}

router.get('/clean', requireResetAuthorization, async (_req, res) => {
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // FULL RESET (FAST & RELIABLE)
    await client.query(`
      TRUNCATE TABLE 
        assessment_sessions,
        players,
        schools
      RESTART IDENTITY CASCADE;
    `);

    await client.query('COMMIT');

    return res.json({
      success: true,
      message: 'Database fully reset'
    });

  } catch (err) {
    await client.query('ROLLBACK');

    console.error('[admin clean error]', err);

    return res.status(500).json({
      success: false,
      message: 'Reset failed',
      error: err.message
    });

  } finally {
    client.release();
  }
});

module.exports = router;