process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'placeholder';

// Mock connectDB so server.js doesn't try to connect to a real DB
jest.mock('../../config/db', () => jest.fn());
// Mock rate limiter so tests don't get blocked after 10 requests
jest.mock('express-rate-limit', () => () => (req, res, next) => next());

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../server');
const Recipe = require('../../models/Recipe');
const User = require('../../models/User');

let mongod;
let authToken;
let userId;
let otherUserToken;
let otherUserId;

const generateToken = (id) =>
  jwt.sign({ userId: id }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });

jest.setTimeout(60000);

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
}, 30000);

beforeEach(async () => {
  // Clear collections
  await Recipe.deleteMany({});
  await User.deleteMany({});

  // Create primary test user
  const user = await User.create({
    username: 'sortuser',
    email: 'sort@test.com',
    password: 'hashedpassword123',
  });
  userId = user._id;
  authToken = generateToken(userId);

  // Create a second user to test ownership scoping
  const otherUser = await User.create({
    username: 'otheruser',
    email: 'other@test.com',
    password: 'hashedpassword123',
  });
  otherUserId = otherUser._id;
  otherUserToken = generateToken(otherUserId);

  // Seed recipes for primary user with distinct values for sorting
  // Use explicit createdAt so we control chronological order
  const now = Date.now();
  await Recipe.create([
    {
      user: userId,
      title: 'Banana Bread',
      ingredients: [{ name: 'banana', amount: 3, unit: 'pcs' }],
      prepTime: 20,
      cookTime: 60,
      category: 'Breakfast',
      createdAt: new Date(now - 3000), // oldest
    },
    {
      user: userId,
      title: 'Apple Pie',
      ingredients: [{ name: 'apple', amount: 5, unit: 'pcs' }],
      prepTime: 45,
      cookTime: 50,
      category: 'Dessert',
      createdAt: new Date(now - 2000),
    },
    {
      user: userId,
      title: 'Caesar Salad',
      ingredients: [{ name: 'lettuce', amount: 1, unit: 'head' }],
      prepTime: 10,
      cookTime: 0,
      category: 'Lunch',
      createdAt: new Date(now - 1000),
    },
    {
      user: userId,
      title: 'Zucchini Soup',
      ingredients: [{ name: 'zucchini', amount: 2, unit: 'pcs' }],
      prepTime: 15,
      cookTime: 30,
      category: 'Dinner',
      createdAt: new Date(now), // newest
    },
  ]);

  // Seed one recipe for the other user (must never appear in primary user results)
  await Recipe.create({
    user: otherUserId,
    title: 'Other User Recipe',
    ingredients: [{ name: 'thing', amount: 1, unit: 'unit' }],
    prepTime: 5,
    cookTime: 5,
  });
});

// ─────────────────────────────────────────────────────────────
// DEFAULT BEHAVIOR
// ─────────────────────────────────────────────────────────────

describe('Default sort (no params)', () => {
  it('returns recipes sorted by createdAt descending (newest first)', async () => {
    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    const titles = res.body.map((r) => r.title);
    expect(titles[0]).toBe('Zucchini Soup');   // newest
    expect(titles[3]).toBe('Banana Bread');     // oldest
  });

  it('does not return recipes from other users', async () => {
    const res = await request(app)
      .get('/api/recipes')
      .set('Authorization', `Bearer ${authToken}`);

    const titles = res.body.map((r) => r.title);
    expect(titles).not.toContain('Other User Recipe');
  });
});

// ─────────────────────────────────────────────────────────────
// SORT BY TITLE
// ─────────────────────────────────────────────────────────────

describe('Sort by title', () => {
  it('returns recipes alphabetically A→Z when sort=title&order=asc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=title&order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.map((r) => r.title);
    expect(titles).toEqual(['Apple Pie', 'Banana Bread', 'Caesar Salad', 'Zucchini Soup']);
  });

  it('returns recipes alphabetically Z→A when sort=title&order=desc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=title&order=desc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.map((r) => r.title);
    expect(titles).toEqual(['Zucchini Soup', 'Caesar Salad', 'Banana Bread', 'Apple Pie']);
  });
});

// ─────────────────────────────────────────────────────────────
// SORT BY createdAt
// ─────────────────────────────────────────────────────────────

describe('Sort by createdAt', () => {
  it('returns oldest recipe first when sort=createdAt&order=asc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=createdAt&order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.map((r) => r.title);
    expect(titles[0]).toBe('Banana Bread');   // oldest
    expect(titles[3]).toBe('Zucchini Soup');  // newest
  });

  it('returns newest recipe first when sort=createdAt&order=desc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=createdAt&order=desc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.map((r) => r.title);
    expect(titles[0]).toBe('Zucchini Soup');  // newest
    expect(titles[3]).toBe('Banana Bread');   // oldest
  });
});

// ─────────────────────────────────────────────────────────────
// SORT BY prepTime
// ─────────────────────────────────────────────────────────────

describe('Sort by prepTime', () => {
  it('returns shortest prep time first when sort=prepTime&order=asc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=prepTime&order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const prepTimes = res.body.map((r) => r.prepTime);
    // Caesar Salad (10) → Zucchini Soup (15) → Banana Bread (20) → Apple Pie (45)
    for (let i = 0; i < prepTimes.length - 1; i++) {
      expect(prepTimes[i]).toBeLessThanOrEqual(prepTimes[i + 1]);
    }
  });

  it('returns longest prep time first when sort=prepTime&order=desc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=prepTime&order=desc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const prepTimes = res.body.map((r) => r.prepTime);
    for (let i = 0; i < prepTimes.length - 1; i++) {
      expect(prepTimes[i]).toBeGreaterThanOrEqual(prepTimes[i + 1]);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// SORT BY cookTime
// ─────────────────────────────────────────────────────────────

describe('Sort by cookTime', () => {
  it('returns shortest cook time first when sort=cookTime&order=asc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=cookTime&order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    const cookTimes = res.body.map((r) => r.cookTime);
    // Caesar Salad (0) → Zucchini Soup (30) → Apple Pie (50) → Banana Bread (60)
    for (let i = 0; i < cookTimes.length - 1; i++) {
      expect(cookTimes[i]).toBeLessThanOrEqual(cookTimes[i + 1]);
    }
  });
});

// ─────────────────────────────────────────────────────────────
// INVALID / EDGE CASE INPUTS (graceful degradation)
// ─────────────────────────────────────────────────────────────

describe('Invalid sort parameters (graceful degradation)', () => {
  it('ignores invalid sort field and falls back to createdAt desc', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=ingredients&order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(4);
    // Should be newest first (createdAt desc default)
    expect(res.body[0].title).toBe('Zucchini Soup');
  });

  it('ignores unknown sort field "__proto__" and falls back to default', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=__proto__&order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body[0].title).toBe('Zucchini Soup');
  });

  it('treats invalid order value as desc (fallback)', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=title&order=random')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // order=random → treated as desc → Z→A
    expect(res.body[0].title).toBe('Zucchini Soup');
  });

  it('handles missing sort with valid order gracefully', async () => {
    const res = await request(app)
      .get('/api/recipes?order=asc')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    // sort defaults to createdAt, order=asc → oldest first
    expect(res.body[0].title).toBe('Banana Bread');
  });

  it('returns 200 with empty array when user has no recipes', async () => {
    // Use other user who has only 1 recipe — delete it first
    await Recipe.deleteMany({ user: otherUserId });

    const res = await request(app)
      .get('/api/recipes?sort=title&order=asc')
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// SORT + CATEGORY FILTER COMBINED
// ─────────────────────────────────────────────────────────────

describe('Sort combined with category filter', () => {
  it('returns only Breakfast recipes sorted by title asc', async () => {
    // Add a second Breakfast recipe for a meaningful sort test
    await Recipe.create({
      user: userId,
      title: 'Avocado Toast',
      ingredients: [{ name: 'avocado', amount: 1, unit: 'pcs' }],
      category: 'Breakfast',
      prepTime: 5,
      cookTime: 0,
    });

    const res = await request(app)
      .get('/api/recipes?sort=title&order=asc&category=Breakfast')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2); // Avocado Toast + Banana Bread
    expect(res.body[0].title).toBe('Avocado Toast');
    expect(res.body[1].title).toBe('Banana Bread');
    // Verify no non-Breakfast recipes leaked in
    res.body.forEach((r) => expect(r.category).toBe('Breakfast'));
  });

  it('returns empty array when category filter matches no recipes', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=title&order=asc&category=Drink')
      .set('Authorization', `Bearer ${authToken}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────────────────────

describe('Auth requirements', () => {
  it('returns 401 when no Authorization header is provided', async () => {
    const res = await request(app).get('/api/recipes?sort=title&order=asc');
    expect(res.status).toBe(401);
  });

  it('other user cannot see primary user recipes even with valid sort params', async () => {
    const res = await request(app)
      .get('/api/recipes?sort=title&order=asc')
      .set('Authorization', `Bearer ${otherUserToken}`);

    expect(res.status).toBe(200);
    const titles = res.body.map((r) => r.title);
    // Other user has 1 recipe: 'Other User Recipe'
    expect(titles).toContain('Other User Recipe');
    expect(titles).not.toContain('Apple Pie');
    expect(titles).not.toContain('Banana Bread');
  });
});
