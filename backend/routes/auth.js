const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');

// Auth routes
router.post('/register', register);
router.post('/login', login);
router.get('/refresh', refresh);
router.post('/logout', auth, logout);

module.exports = router;