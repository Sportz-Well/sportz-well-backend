'use strict';
const express = require('express');
const router  = express.Router();

// Reset DB endpoint permanently disabled.
// This route intentionally returns 410 Gone.
// Do not restore this endpoint — it deletes live player data.
router.post('/reset', (req, res) => {
  console.warn(`SECURITY: Reset DB attempt blocked from IP ${req.ip}`);
  res.status(410).json({
    error: "This endpoint has been permanently disabled.",
    code:  "ENDPOINT_RETIRED"
  });
});

module.exports = router;