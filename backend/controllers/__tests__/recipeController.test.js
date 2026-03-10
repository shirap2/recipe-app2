const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

// Set env vars before any require that reads them
process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.MONGODB_URI = 'placeholder';

// Mock connectDB so server.js doesn't try to connect to a real DB
jest.mock('../../config/db', () => jest.fn());
// Mock rate limiter so tests don't get blocked after 10 requests
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const app = require('../../server');
const User = require('../../models/User');
const Recipe = require('../../models/Recipe');
const { generateAccessToken } = require('../../__tests__/helpers/auth');

let mongod;
let userA, userB, tokenA, tokenB;

const validRecipe = {
  title: 'Test Pasta',
  ingredients: [{ name: 'Pasta', amount: 200, unit: 'g' }],
};

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  userA = await User.create({
    username: 'usera',
    email: 'a@example.com',
    password: 'hashedpassword',
  });
  userB = await User.create({
    username: 'userb',
    email: 'b@example.com',
    password: 'hashedpassword',
  });

  tokenA = generateAccessToken(userA._id.toString());
  tokenB = generateAccessToken(userB._id.toString());
});

// ── GET /api/recipes ───────────────────────────────────────────────────────
describe('GET /api/recipes', () => {
  it('returns 200 with empty array when no recipes exist', async () => {
    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns only recipes belonging to the authenticated user', async () => {
    await Recipe.create({ ...validRecipe, user: userA._id });
    await Recipe.create({ title: 'User B Recipe', ingredients: [{ name: 'Egg', amount: 1, unit: 'pcs' }], user: userB._id });

    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Test Pasta');
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/recipes');
    expect(res.status).toBe(401);
  });

  it('filters by category when ?category= is provided', async () => {
    await Recipe.create({ ...validRecipe, user: userA._id, category: 'Dinner' });
    await Recipe.create({ title: 'Breakfast Bowl', ingredients: [{ name: 'Oats', amount: 100, unit: 'g' }], user: userA._id, category: 'Breakfast' });

    const res = await request(app)
      .get('/api/recipes?category=Dinner')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].category).toBe('Dinner');
  });

  it('returns all recipes when no category filter', async () => {
    await Recipe.create({ ...validRecipe, user: userA._id, category: 'Dinner' });
    await Recipe.create({ title: 'Breakfast Bowl', ingredients: [{ name: 'Oats', amount: 100, unit: 'g' }], user: userA._id, category: 'Breakfast' });

    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(2);
  });

  it('returns recipe fields including title and ingredients', async () => {
    await Recipe.create({ ...validRecipe, user: userA._id });

    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Test Pasta');
    expect(Array.isArray(res.body[0].ingredients)).toBe(true);
  });
});

// ── GET /api/recipes/search ────────────────────────────────────────────────
describe('GET /api/recipes/search', () => {
  beforeEach(async () => {
    await Recipe.create({ title: 'Chicken Soup', ingredients: [{ name: 'Chicken', amount: 500, unit: 'g' }], tags: ['comfort'], user: userA._id });
    await Recipe.create({ title: 'Pasta Carbonara', ingredients: [{ name: 'Pasta', amount: 200, unit: 'g' }], tags: ['italian'], user: userA._id });
    await Recipe.create({ title: 'Beef Tacos', ingredients: [{ name: 'Beef', amount: 300, unit: 'g' }], tags: ['mexican'], user: userB._id });
  });

  it('returns recipes matching title query', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=chicken')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Chicken Soup');
  });

  it('returns recipes matching tag query', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=italian')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].title).toBe('Pasta Carbonara');
  });

  it('returns empty array for no matches', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=sushi')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns empty array for empty query', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('does not return results from other users', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=tacos')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('is case-insensitive', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=CHICKEN')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).get('/api/recipes/search?query=pasta');
    expect(res.status).toBe(401);
  });

  it('handles regex special chars without error', async () => {
    const res = await request(app)
      .get('/api/recipes/search?query=.*+?^${}()|[]\\')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// ── GET /api/recipes/:id ───────────────────────────────────────────────────
describe('GET /api/recipes/:id', () => {
  it('returns 200 with recipe for valid id and owner', async () => {
    const recipe = await Recipe.create({ ...validRecipe, user: userA._id });

    const res = await request(app)
      .get(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Test Pasta');
  });

  it('returns 404 when recipe does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .get(`/api/recipes/${fakeId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
    expect(res.body.message).toBe('Recipe not found');
  });

  it('returns 404 when recipe belongs to another user', async () => {
    const recipe = await Recipe.create({ ...validRecipe, user: userB._id });

    const res = await request(app)
      .get(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const recipe = await Recipe.create({ ...validRecipe, user: userA._id });
    const res = await request(app).get(`/api/recipes/${recipe._id}`);
    expect(res.status).toBe(401);
  });
});

// ── POST /api/recipes ──────────────────────────────────────────────────────
describe('POST /api/recipes', () => {
  it('creates recipe and returns 201 with body', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validRecipe);
    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Test Pasta');
  });

  it('associates recipe with authenticated user', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validRecipe);
    expect(res.status).toBe(201);
    expect(res.body.user).toBe(userA._id.toString());
  });

  it('persists recipe in database', async () => {
    await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send(validRecipe);
    const count = await Recipe.countDocuments({ user: userA._id });
    expect(count).toBe(1);
  });

  it('accepts optional fields (category, difficulty, notes)', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validRecipe, category: 'Dinner', difficulty: 'Easy', notes: 'Simple' });
    expect(res.status).toBe(201);
    expect(res.body.category).toBe('Dinner');
    expect(res.body.difficulty).toBe('Easy');
    expect(res.body.notes).toBe('Simple');
  });

  it('missing title returns 400', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ingredients: [{ name: 'Egg', amount: 1, unit: 'pcs' }] });
    expect(res.status).toBe(400);
  });

  it('missing ingredients returns 400', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'No Ingredients' });
    expect(res.status).toBe(400);
  });

  it('empty ingredients array returns 400', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Test Recipe', ingredients: [] });
    expect(res.status).toBe(400);
  });

  it('invalid category enum returns 400', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validRecipe, category: 'Brunch' });
    expect(res.status).toBe(400);
  });

  it('invalid difficulty enum returns 400', async () => {
    const res = await request(app)
      .post('/api/recipes')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ ...validRecipe, difficulty: 'Expert' });
    expect(res.status).toBe(400);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).post('/api/recipes').send(validRecipe);
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/recipes/:id ─────────────────────────────────────────────────
describe('PATCH /api/recipes/:id', () => {
  let recipe;

  beforeEach(async () => {
    recipe = await Recipe.create({ ...validRecipe, user: userA._id });
  });

  it('returns 200 with updated fields', async () => {
    const res = await request(app)
      .patch(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated Pasta' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Updated Pasta');
  });

  it('persists update in database', async () => {
    await request(app)
      .patch(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Updated Pasta' });
    const updated = await Recipe.findById(recipe._id);
    expect(updated.title).toBe('Updated Pasta');
  });

  it('returns 404 when recipe belongs to another user', async () => {
    const res = await request(app)
      .patch(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hijacked' });
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent recipe', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .patch(`/api/recipes/${fakeId}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Ghost' });
    expect(res.status).toBe(404);
  });

  it('invalid category enum returns 400', async () => {
    const res = await request(app)
      .patch(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ category: 'Brunch' });
    expect(res.status).toBe(400);
  });

  it('empty body returns 200 (partial update allowed)', async () => {
    const res = await request(app)
      .patch(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({});
    expect(res.status).toBe(200);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app)
      .patch(`/api/recipes/${recipe._id}`)
      .send({ title: 'No Auth' });
    expect(res.status).toBe(401);
  });
});

// ── DELETE /api/recipes/:id ────────────────────────────────────────────────
describe('DELETE /api/recipes/:id', () => {
  let recipe;

  beforeEach(async () => {
    recipe = await Recipe.create({ ...validRecipe, user: userA._id });
  });

  it('returns 200 with success message', async () => {
    const res = await request(app)
      .delete(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Recipe deleted successfully');
  });

  it('removes recipe from database', async () => {
    await request(app)
      .delete(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenA}`);
    const found = await Recipe.findById(recipe._id);
    expect(found).toBeNull();
  });

  it('returns 404 when recipe belongs to another user', async () => {
    const res = await request(app)
      .delete(`/api/recipes/${recipe._id}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(res.status).toBe(404);
  });

  it('returns 404 for non-existent recipe', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    const res = await request(app)
      .delete(`/api/recipes/${fakeId}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth token', async () => {
    const res = await request(app).delete(`/api/recipes/${recipe._id}`);
    expect(res.status).toBe(401);
  });
});
