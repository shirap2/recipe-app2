const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
// Prevent connectDB from exiting — will be overridden after we start MongoMemoryServer
process.env.MONGODB_URI = 'placeholder';

// Mock connectDB so server.js does not call mongoose.connect at require time
jest.mock('../../config/db', () => jest.fn());

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

afterEach(async () => {
  await User.deleteMany({});
});

const makeToken = (userId) =>
  jwt.sign({ userId }, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '5m' });

describe('GET /api/users/me', () => {
  it('returns 200 with id, username, and email for an authenticated user', async () => {
    const user = await User.create({
      username: 'alice',
      email: 'alice@example.com',
      password: 'hashedpassword',
    });

    const token = makeToken(user._id.toString());

    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      username: 'alice',
      email: 'alice@example.com',
    });
    expect(res.body.id).toBeDefined();
    expect(res.body.password).toBeUndefined();
  });

  it('returns 401 without a token', async () => {
    const res = await request(app).get('/api/users/me');

    expect(res.status).toBe(401);
  });
});
