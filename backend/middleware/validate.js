const { z } = require('zod');

/**
 * Express middleware factory. Validates req.body against a Zod schema.
 * On failure returns 400 with { message, errors }.
 * On success calls next().
 */
function validate(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const errors = result.error.issues.map(e => ({
        field: e.path.join('.'),
        message: e.message,
      }));
      return res.status(400).json({ message: 'Validation failed.', errors });
    }
    req.body = result.data; // replace with parsed + coerced data
    next();
  };
}

// ── Auth schemas ───────────────────────────────────────────────────────────
const registerSchema = z.object({
  username: z
    .string({ required_error: 'Username is required.' })
    .min(3, 'Username must be at least 3 characters.')
    .max(30, 'Username must be at most 30 characters.')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username may only contain letters, numbers, and underscores.'),
  email: z
    .string({ required_error: 'Email is required.' })
    .email('Must be a valid email address.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(6, 'Password must be at least 6 characters.'),
});

const loginSchema = z.object({
  username: z
    .string({ required_error: 'Username or email is required.' })
    .min(1, 'Username or email is required.'),
  password: z
    .string({ required_error: 'Password is required.' })
    .min(1, 'Password is required.'),
});

// ── Recipe schemas ─────────────────────────────────────────────────────────
const ingredientSchema = z.object({
  name:   z.string({ error: 'Ingredient name is required.' }).min(1, 'Ingredient name is required.'),
  amount: z.number({ error: 'Amount must be a number.' }).positive('Amount must be positive.'),
  unit:   z.string({ error: 'Unit is required.' }).min(1, 'Unit is required.'),
});

const recipeCreateSchema = z.object({
  title: z
    .string({ required_error: 'Title is required.' })
    .min(3, 'Title must be at least 3 characters.'),
  ingredients: z
    .array(ingredientSchema)
    .min(1, 'At least one ingredient is required.'),
  instructions: z
    .array(z.string())
    .optional(),
  prepTime:   z.number().int().nonnegative().optional(),
  cookTime:   z.number().int().nonnegative().optional(),
  servings:   z.number().int().positive().optional(),
  tags:       z.array(z.string()).optional(),
  notes:      z.string().optional(),
  difficulty: z.enum(['Easy', 'Medium', 'Hard']).optional(),
  category:   z.enum(['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other']).optional(),
});

// For PATCH — all fields optional
const recipeUpdateSchema = recipeCreateSchema.partial();

module.exports = { validate, registerSchema, loginSchema, recipeCreateSchema, recipeUpdateSchema };
