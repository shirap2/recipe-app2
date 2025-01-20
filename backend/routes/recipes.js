const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const validateRecipe = require('../middleware/validateRecipe'); // Import the middleware

// GET all recipes
router.get('/', async (req, res, next) => {
    try {
        const recipes = await Recipe.find().sort({ created: -1 }); // Sort by newest first
        res.json(recipes);
    } catch (error) {
        next(error);
    }
});

// GET single recipe by ID
router.get('/:id', async (req, res, next) => {
    try {
        const recipe = await Recipe.findById(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        next(error);
    }
});

// POST new recipe
router.post('/', validateRecipe, async (req, res, next) => {
    try {
        const recipe = new Recipe(req.body);
        const savedRecipe = await recipe.save();
        res.status(201).json(savedRecipe);
    } catch (error) {
        next(error);
    }
});

// PATCH update recipe
router.patch('/:id', validateRecipe, async (req, res, next) => {
    try {
        const recipe = await Recipe.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json(recipe);
    } catch (error) {
        next(error);
    }
});

// DELETE recipe
router.delete('/:id', async (req, res, next) => {
    try {
        const recipe = await Recipe.findByIdAndDelete(req.params.id);
        if (!recipe) {
            return res.status(404).json({ message: 'Recipe not found' });
        }
        res.json({ message: 'Recipe deleted successfully' });
    } catch (error) {
        next(error);
    }
});

// Search recipes by title
router.get('/search/:title', async (req, res, next) => {
    try {
        const recipes = await Recipe.find({
            title: { $regex: req.params.title, $options: 'i' }
        });
        res.json(recipes);
    } catch (error) {
        next(error);
    }
});

module.exports = router;
