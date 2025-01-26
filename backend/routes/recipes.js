// routes/recipes.js
const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const authMiddleware = require('../middleware/auth');

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get all recipes
router.get('/', recipeController.getAllRecipes);

// Get single recipe
router.get('/:id', recipeController.getRecipeById);

// Create new recipe
router.post('/', recipeController.createRecipe);

// Update recipe
router.patch('/:id', recipeController.updateRecipe);

// Delete recipe
router.delete('/:id', recipeController.deleteRecipe);

// Search recipes
router.get('/search', recipeController.searchRecipes);

module.exports = router;