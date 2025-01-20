// backend/middleware/auth.js
const jwt = require('jsonwebtoken');

const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({ message: 'No auth token found' });
    }

    // Verify token
    const decoded = jwt.verify(token, 'your_jwt_secret');  // Move to environment variable in production
    req.user = decoded;
    next();
  } catch (err) {
    res.status(401).json({ message: 'Token is invalid' });
  }
};

module.exports = authMiddleware;


