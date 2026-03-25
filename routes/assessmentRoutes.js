'use strict';

const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: [
      { player_id: 1, score: 82 },
      { player_id: 2, score: 76 }
    ]
  });
});

router.post('/', (req, res) => {
  res.json({
    success: true,
    message: "Assessment saved"
  });
});

module.exports = router;