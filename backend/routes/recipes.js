// routes/recipes.js
const express = require('express');
const router = express.Router();
const recipeController = require('../controllers/recipeController');
const { validate, recipeCreateSchema, recipeUpdateSchema } = require('../middleware/validate');

// Search recipes
router.get('/search', recipeController.searchRecipes);

// Get all recipes
router.get('/', recipeController.getAllRecipes);

// Get single recipe
router.get('/:id', recipeController.getRecipeById);

// Create new recipe
router.post('/',     validate(recipeCreateSchema), recipeController.createRecipe);

// Update recipe
router.patch('/:id', validate(recipeUpdateSchema), recipeController.updateRecipe);

// Delete recipe
router.delete('/:id', recipeController.deleteRecipe);



module.exports = router;
