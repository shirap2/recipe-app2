// backend/middleware/validateRecipe.js
const validateRecipe = (req, res, next) => {
    const { title, ingredients, instructions, prepTime, cookTime, servings } = req.body;
  
    const errors = [];
  
    if (title !== undefined && title.trim() === '') {
        errors.push('Title cannot be empty');
    }

    if (ingredients !== undefined && (!Array.isArray(ingredients) || ingredients.length === 0)) {
        errors.push('At least one ingredient is required');
    }

    if (instructions !== undefined && (!Array.isArray(instructions) || instructions.length === 0)) {
        errors.push('At least one instruction step is required');
    }

    if (cookTime !== undefined && (typeof cookTime !== 'number' || cookTime <= 0)) {
        errors.push('Valid cooking time is required');
    }

    if (servings !== undefined && (typeof servings !== 'number' || servings <= 0)) {
        errors.push('Valid number of servings is required');
    }

    if (errors.length > 0) {
        return res.status(400).json({ errors });
    }

    next();
  };
  
  module.exports = validateRecipe;