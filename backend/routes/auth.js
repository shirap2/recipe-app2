const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const authenticateToken = require('../middleware/authenticateToken');

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/refresh', refresh);
router.post('/logout', authenticateToken, logout);

module.exports = router;