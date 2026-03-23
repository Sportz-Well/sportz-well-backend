const express = require('express');
const router = express.Router();
const db = require('../db');

// ⚠️ TEMP ROUTE — DELETE AFTER USE
router.get('/clean', async (req, res) => {
  try {
    await db.query('DELETE FROM players');
    res.json({ success: true, message: "All players deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;