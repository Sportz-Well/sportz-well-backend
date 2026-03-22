'use strict';

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.login);
router.get('/create-admin', authController.createAdmin);

module.exports = router;