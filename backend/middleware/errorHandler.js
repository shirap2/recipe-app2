// backend/middleware/errorHandler.js
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
  
    if (err.name === 'ValidationError') {
      return res.status(400).json({ 
        message: 'Validation Error', 
        errors: Object.values(err.errors).map(e => e.message) 
      });
    }
  
    if (err.name === 'CastError') {
      return res.status(400).json({ 
        message: 'Invalid ID format' 
      });
    }
  
    // Default error
    res.status(500).json({ 
      message: 'Internal Server Error',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  };
  
  module.exports = errorHandler;