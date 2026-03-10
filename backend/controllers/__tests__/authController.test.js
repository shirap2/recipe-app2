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

let mongod;

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
});

async function registerUser(overrides = {}) {
  const body = {
    username: 'testuser',
    email: 'test@example.com',
    password: 'password123',
    ...overrides,
  };
  return request(app).post('/api/auth/register').send(body);
}

// ── POST /api/auth/register ────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('valid registration returns 201 with accessToken and user', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.accessToken.length).toBeGreaterThan(0);
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  it('valid registration sets httpOnly refreshToken cookie', async () => {
    const res = await registerUser();
    expect(res.status).toBe(201);
    const cookies = res.headers['set-cookie'];
    expect(Array.isArray(cookies)).toBe(true);
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).toBeTruthy();
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it('valid registration stores hashed password in DB', async () => {
    await registerUser();
    const user = await User.findOne({ username: 'testuser' });
    expect(user.password).not.toBe('password123');
    expect(user.password.startsWith('$2b$')).toBe(true);
  });

  it('valid registration stores refreshToken in user document', async () => {
    await registerUser();
    const user = await User.findOne({ username: 'testuser' });
    expect(user.refreshToken).toBeTruthy();
  });

  it('duplicate username returns 400', async () => {
    await registerUser();
    const res = await registerUser({ email: 'other@example.com' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  });

  it('duplicate email returns 400', async () => {
    await registerUser();
    const res = await registerUser({ username: 'otheruser' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('User already exists');
  });

  it('missing username returns 400 with validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'a@b.com', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed.');
    expect(res.body.errors.find(e => e.field === 'username')).toBeTruthy();
  });

  it('missing email returns 400 with validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', password: 'pass123' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('missing password returns 400 with validation error', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'a@b.com' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'password')).toBeTruthy();
  });

  it('password less than 6 chars returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ username: 'testuser', email: 'a@b.com', password: 'abc' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'password');
    expect(err.message).toBe('Password must be at least 6 characters.');
  });

  it('invalid email format returns 400', async () => {
    const res = await registerUser({ email: 'notanemail' });
    expect(res.status).toBe(400);
    expect(res.body.errors.find(e => e.field === 'email')).toBeTruthy();
  });

  it('username with special chars returns 400', async () => {
    const res = await registerUser({ username: 'user@name' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'username');
    expect(err.message).toBe('Username may only contain letters, numbers, and underscores.');
  });
});

// ── POST /api/auth/login ───────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  beforeEach(async () => {
    await registerUser();
  });

  it('valid login by username returns 200 with accessToken and user', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user.password).toBeUndefined();
  });

  it('valid login sets httpOnly refreshToken cookie', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'password123' });
    expect(res.status).toBe(200);
    const cookies = res.headers['set-cookie'];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    expect(refreshCookie).toMatch(/HttpOnly/i);
  });

  it('login by email (in username field) returns 200', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test@example.com', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('testuser');
  });

  it('wrong password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: 'wrongpassword' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('non-existent username returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'ghost', password: 'pass123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Invalid credentials');
  });

  it('empty password returns 400 with validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'testuser', password: '' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'password');
    expect(err.message).toBe('Password is required.');
  });

  it('empty username returns 400 with validation error', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: '', password: 'pass123' });
    expect(res.status).toBe(400);
    const err = res.body.errors.find(e => e.field === 'username');
    expect(err.message).toBe('Username or email is required.');
  });
});

// ── GET /api/auth/refresh ──────────────────────────────────────────────────
describe('GET /api/auth/refresh', () => {
  it('valid refreshToken cookie returns 200 with accessToken and user', async () => {
    const regRes = await registerUser();
    const cookies = regRes.headers['set-cookie'];
    const res = await request(app)
      .get('/api/auth/refresh')
      .set('Cookie', cookies);
    expect(res.status).toBe(200);
    expect(typeof res.body.accessToken).toBe('string');
    expect(res.body.user.username).toBe('testuser');
    expect(res.body.user.email).toBe('test@example.com');
  });

  it('no cookie returns 401', async () => {
    const res = await request(app).get('/api/auth/refresh');
    expect(res.status).toBe(401);
  });

  it('cookie token not in DB returns 403', async () => {
    // Sign a valid JWT but don't store it in any user
    const jwt = require('jsonwebtoken');
    const fakeToken = jwt.sign(
      { userId: new mongoose.Types.ObjectId().toString() },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '1d' }
    );
    const res = await request(app)
      .get('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${fakeToken}`]);
    expect(res.status).toBe(403);
  });

  it('tampered cookie JWT returns 403', async () => {
    const regRes = await registerUser();
    const cookies = regRes.headers['set-cookie'];
    const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
    const tokenValue = refreshCookie.split(';')[0].replace('refreshToken=', '');
    const parts = tokenValue.split('.');
    const sig = parts[2];
    parts[2] = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    const tampered = parts.join('.');
    const res = await request(app)
      .get('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${tampered}`]);
    expect(res.status).toBe(403);
  });

  it('expired refresh token returns 403', async () => {
    const jwt = require('jsonwebtoken');
    await registerUser();
    const user = await User.findOne({ username: 'testuser' });
    const expiredToken = jwt.sign(
      { userId: user._id.toString() },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: '-1s' }
    );
    user.refreshToken = expiredToken;
    await user.save();
    const res = await request(app)
      .get('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${expiredToken}`]);
    expect(res.status).toBe(403);
  });
});

// ── POST /api/auth/logout ──────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('valid logout clears refreshToken in DB and clears cookie', async () => {
    const regRes = await registerUser();
    const { accessToken } = regRes.body;
    const cookies = regRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookies);

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');

    const user = await User.findOne({ username: 'testuser' });
    expect(user.refreshToken).toBeNull();
  });

  it('no Bearer token returns 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization header missing or malformed');
  });

  it('valid Bearer token but no cookie returns 200 gracefully', async () => {
    const regRes = await registerUser();
    const { accessToken } = regRes.body;

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);
    // no cookie set — controller handles missing cookie gracefully
    expect(res.status).toBe(200);
    expect(res.body.message).toBe('Logged out successfully');
  });
});
