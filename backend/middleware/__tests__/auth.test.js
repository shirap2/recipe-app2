const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

process.env.ACCESS_TOKEN_SECRET = 'test-access-secret';
process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';

const auth = require('../auth');

// Minimal test app — no DB needed
const app = express();
app.use(express.json());
app.use('/protected', auth, (req, res) => {
  res.json({ userId: req.user.userId });
});

const validId = '507f1f77bcf86cd799439011';

function makeToken(userId, secret = process.env.ACCESS_TOKEN_SECRET, expiresIn = '5m') {
  return jwt.sign({ userId }, secret, { expiresIn });
}

describe('auth middleware', () => {
  it('returns 401 when Authorization header is missing', async () => {
    const res = await request(app).get('/protected');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization header missing or malformed');
  });

  it('returns 401 when Authorization header lacks "Bearer " prefix', async () => {
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'token abc123');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization header missing or malformed');
  });

  it('returns 401 when Authorization header is "Bearer" with no token', async () => {
    // HTTP trims trailing whitespace, so 'Bearer ' becomes 'Bearer' — treated as malformed
    const res = await request(app)
      .get('/protected')
      .set('Authorization', 'Bearer ');
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Authorization header missing or malformed');
  });

  it('returns 200 and populates req.user for a valid token', async () => {
    const token = makeToken(validId);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(validId);
  });

  it('returns 403 for an expired token', async () => {
    const token = makeToken(validId, process.env.ACCESS_TOKEN_SECRET, '-1s');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('returns 403 for a token signed with wrong secret', async () => {
    const token = makeToken(validId, 'wrong-secret');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('returns 403 for a tampered token', async () => {
    const token = makeToken(validId);
    // Flip last character of signature segment
    const parts = token.split('.');
    const sig = parts[2];
    parts[2] = sig.slice(0, -1) + (sig.slice(-1) === 'a' ? 'b' : 'a');
    const tampered = parts.join('.');
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(403);
    expect(res.body.message).toBe('Invalid or expired token');
  });

  it('req.user.userId matches the token payload', async () => {
    const specificId = '507f191e810c19729de860ea';
    const token = makeToken(specificId);
    const res = await request(app)
      .get('/protected')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.userId).toBe(specificId);
  });
});
