// backend/middleware/logger.js
const logger = (req, res, next) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const path = req.path;
    const query = Object.keys(req.query).length > 0 ? JSON.stringify(req.query) : '';
    
    console.log(`[${timestamp}] ${method} ${path} ${query}`);
    
    // Also log request body for POST/PUT/PATCH requests
    if (['POST', 'PUT', 'PATCH'].includes(method)) {
      console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    
    next();
  };
  
  module.exports = logger;