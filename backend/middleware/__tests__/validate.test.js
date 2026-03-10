const express = require('express');
const request = require('supertest');
const {
  validate,
  registerSchema,
  loginSchema,
  recipeCreateSchema,
  recipeUpdateSchema,
} = require('../validate');

function makeApp(schema) {
  const app = express();
  app.use(express.json());
  app.post('/test', validate(schema), (req, res) => res.json(req.body));
  return app;
}

// ── validate() core behavior ───────────────────────────────────────────────
describe('validate() core behavior', () => {
  const app = makeApp(registerSchema);
  const validBody = { username: 'alice', email: 'alice@test.com', password: 'password123' };

  it('valid body passes through with 200', async () => {
    const res = await request(app).post('/test').send(validBody);
    expect(res.status).toBe(200);
  });

  it('unknown fields are stripped from req.body', async () => {
    const res = await request(app)
      .post('/test')
      .send({ ...validBody, extraField: 'hacked' });
    expect(res.status).toBe(200);
    expect(res.body.extraField).toBeUndefined();
  });

  it('missing required field returns 400 with correct shape', async () => {
    const res = await request(app)
      .post('/test')
      .send({ email: 'a@b.com', password: 'pass123' }); // missing username
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed.');
    expect(Array.isArray(res.body.errors)).toBe(true);
    const err = res.body.errors[0];
    expect(typeof err.field).toBe('string');
    expect(typeof err.message).toBe('string');
  });
});

// ── registerSchema ─────────────────────────────────────────────────────────
describe('registerSchema', () => {
  const app = makeApp(registerSchema);

  it('username too short → 400 with correct message', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'ab', email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'username');
    expect(err.message).toBe('Username must be at least 3 characters.');
  });

  it('username too long → 400 with correct message', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'a'.repeat(31), email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'username');
    expect(err.message).toBe('Username must be at most 30 characters.');
  });

  it('username with special chars → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'user@name', email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'username');
    expect(err.message).toBe('Username may only contain letters, numbers, and underscores.');
  });

  it('username with hyphen → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'user-name', email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'username')).toBeTruthy();
  });

  it('username with underscore → 200 (allowed)', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'user_name', email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(200);
  });

  it('invalid email format → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'validuser', email: 'not-an-email', password: 'pass123' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'email');
    expect(err.message).toBe('Must be a valid email address.');
  });

  it('password too short → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'validuser', email: 'a@b.com', password: 'abc' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'password');
    expect(err.message).toBe('Password must be at least 6 characters.');
  });

  it('password exactly 6 chars → 200', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'validuser', email: 'a@b.com', password: 'abcdef' });
    expect(res.status).toBe(200);
  });

  it('missing username → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'username')).toBeTruthy();
  });

  it('missing email → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'validuser', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('missing password → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'validuser', email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'password')).toBeTruthy();
  });
});

// ── loginSchema ────────────────────────────────────────────────────────────
describe('loginSchema', () => {
  const app = makeApp(loginSchema);

  it('empty username → 400 with correct message', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: '', password: 'pass123' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'username');
    expect(err.message).toBe('Username or email is required.');
  });

  it('empty password → 400 with correct message', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'testuser', password: '' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'password');
    expect(err.message).toBe('Password is required.');
  });

  it('valid login body → 200', async () => {
    const res = await request(app)
      .post('/test')
      .send({ username: 'testuser', password: 'pass123' });
    expect(res.status).toBe(200);
    expect(res.body.username).toBe('testuser');
  });
});

// ── recipeCreateSchema ─────────────────────────────────────────────────────
describe('recipeCreateSchema', () => {
  const app = makeApp(recipeCreateSchema);
  const validIngredient = { name: 'Egg', amount: 2, unit: 'pcs' };

  it('missing title → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ ingredients: [validIngredient] });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'title')).toBeTruthy();
  });

  it('title too short → 400 with correct message', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'AB', ingredients: [validIngredient] });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'title');
    expect(err.message).toBe('Title must be at least 3 characters.');
  });

  it('title exactly 3 chars → 200', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Egg', ingredients: [validIngredient] });
    expect(res.status).toBe(200);
  });

  it('empty ingredients array → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test Recipe', ingredients: [] });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'ingredients');
    expect(err).toBeTruthy();
    expect(err.message).toMatch(/at least one ingredient/i);
  });

  it('missing ingredients field → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test Recipe' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'ingredients')).toBeTruthy();
  });

  it('ingredient missing name → 400 with correct field path', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [{ amount: 2, unit: 'pcs' }] });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'ingredients.0.name');
    expect(err.message).toBe('Ingredient name is required.');
  });

  it('ingredient missing unit → 400 with correct field path', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [{ name: 'Egg', amount: 2 }] });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'ingredients.0.unit');
    expect(err.message).toBe('Unit is required.');
  });

  it('ingredient amount is a string → 400 with correct message', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [{ name: 'Egg', amount: 'two', unit: 'pcs' }] });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'ingredients.0.amount');
    expect(err.message).toBe('Amount must be a number.');
  });

  it('ingredient amount of 0 → 400 (must be positive)', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [{ name: 'Egg', amount: 0, unit: 'pcs' }] });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'ingredients.0.amount')).toBeTruthy();
  });

  it('invalid category enum → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [validIngredient], category: 'Brunch' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'category')).toBeTruthy();
  });

  it('valid category enum → 200', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [validIngredient], category: 'Dinner' });
    expect(res.status).toBe(200);
    expect(res.body.category).toBe('Dinner');
  });

  it('invalid difficulty enum → 400', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [validIngredient], difficulty: 'Expert' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'difficulty')).toBeTruthy();
  });

  it('valid difficulty enum → 200', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [validIngredient], difficulty: 'Hard' });
    expect(res.status).toBe(200);
    expect(res.body.difficulty).toBe('Hard');
  });

  it('all optional fields absent → 200', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Test', ingredients: [validIngredient] });
    expect(res.status).toBe(200);
  });
});

// ── recipeUpdateSchema ─────────────────────────────────────────────────────
describe('recipeUpdateSchema', () => {
  const app = makeApp(recipeUpdateSchema);

  it('completely empty body → 200', async () => {
    const res = await request(app).post('/test').send({});
    expect(res.status).toBe(200);
    expect(res.body).toEqual({});
  });

  it('partial update (title only) → 200', async () => {
    const res = await request(app).post('/test').send({ title: 'New Title' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('New Title');
  });

  it('invalid category in update → 400', async () => {
    const res = await request(app).post('/test').send({ category: 'Invalid' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'category')).toBeTruthy();
  });

  it('invalid difficulty in update → 400', async () => {
    const res = await request(app).post('/test').send({ difficulty: 'Novice' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'difficulty')).toBeTruthy();
  });

  it('unknown field stripped from output', async () => {
    const res = await request(app)
      .post('/test')
      .send({ title: 'Valid', unknownField: 'attack' });
    expect(res.status).toBe(200);
    expect(res.body.unknownField).toBeUndefined();
  });
});
