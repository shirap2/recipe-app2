const express = require('express');
const router = express.Router();
const { register, login, refresh, logout } = require('../controllers/authController');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');
const { validate, registerSchema, loginSchema } = require('../middleware/validate');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many attempts, please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Auth routes
router.post('/register', authLimiter, validate(registerSchema), register);
router.post('/login',    authLimiter, validate(loginSchema),    login);
router.get('/refresh', refresh);
router.post('/logout', auth, logout);

module.exports = router;
