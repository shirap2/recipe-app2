const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.ACCESS_TOKEN_SECRET  || 'test-access-secret';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';

const generateAccessToken = (userId) =>
  jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '5m' });

const generateExpiredAccessToken = (userId) =>
  jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '-1s' });

const generateRefreshToken = (userId) =>
  jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '1d' });

const generateExpiredRefreshToken = (userId) =>
  jwt.sign({ userId }, REFRESH_SECRET, { expiresIn: '-1s' });

const generateWrongSecretToken = (userId) =>
  jwt.sign({ userId }, 'wrong-secret', { expiresIn: '5m' });

module.exports = {
  generateAccessToken,
  generateExpiredAccessToken,
  generateRefreshToken,
  generateExpiredRefreshToken,
  generateWrongSecretToken,
};
