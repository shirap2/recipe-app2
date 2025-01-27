const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const cookieParser = require('cookie-parser'); // Add this
const connectDB = require('./config/db');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: 'http://localhost:3000', // or your frontend URL
  credentials: true // important for cookies
}));
app.use(express.json());
app.use(cookieParser()); // Add this for handling cookies

// Database connection
connectDB();

// Import routes
const recipesRouter = require('./routes/recipes');
const authRoutes = require('./routes/auth');
app.use('/api/auth', authRoutes);

const authenticate = require('./middleware/auth');

app.use('/api/recipes', authenticate, recipesRouter);

// // Route to see all available routes (for debugging)
// app.get('/api/routes', (req, res) => {
//   let routes = [];
//   app._router.stack.forEach((middleware) => {
//     if (middleware.route) {
//       routes.push({
//         path: middleware.route.path,
//         methods: Object.keys(middleware.route.methods)
//       });
//     }
//   });
//   res.json(routes);
// });



// app.use((req, res) => {
//   res.status(404).json({ message: 'Route not found' });
// });

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Internal Server Error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});