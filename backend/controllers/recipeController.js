// controllers/recipeController.js
const Recipe = require('../models/Recipe');

// Get all recipes for a user
exports.getAllRecipes = async (req, res) => {
  try {
    const recipes = await Recipe.find({ user: req.user.userId });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single recipe
exports.getRecipeById = async (req, res) => {
  try {
    const recipe = await Recipe.findOne({ 
      _id: req.params.id, 
      user: req.user.userId 
    });
    
    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }
    
    res.json(recipe);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create new recipe
exports.createRecipe = async (req, res) => {
  try {
    const recipe = new Recipe({
      ...req.body,
      user: req.user.userId
    });

    const newRecipe = await recipe.save();
    res.status(201).json(newRecipe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update recipe
exports.updateRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndUpdate(
      { _id: req.params.id, user: req.user.userId },
      req.body,
      { new: true, runValidators: true }
    );

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json(recipe);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete recipe
exports.deleteRecipe = async (req, res) => {
  try {
    const recipe = await Recipe.findOneAndDelete({ 
      _id: req.params.id, 
      user: req.user.userId 
    });

    if (!recipe) {
      return res.status(404).json({ message: 'Recipe not found' });
    }

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Search recipes
exports.searchRecipes = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim() === '') {
      return res.json([]);
    }

    // Escape special regex characters to prevent ReDoS
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');

    const recipes = await Recipe.find({
      user: req.user.userId,
      $or: [
        { title: regex },
        { tags: regex }
      ]
    });

    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};