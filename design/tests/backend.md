# Backend Test Design

**Date:** 2026-03-09
**Tools:** Jest 29, Supertest 7, mongodb-memory-server 10
**Test runner config:** `jest --runInBand` (sequential, required for shared in-memory DB)
**Module system:** CommonJS (`"transform": {}` in package.json — no Babel/ESM transform)

---

## Critical Implementation Notes

These facts from the source code directly determine expected test outcomes and must not be assumed:

| Fact | Source | Impact on tests |
|------|--------|-----------------|
| Auth middleware returns **401** for missing/malformed header, **403** for any JWT error (expired, wrong secret, tampered) | `middleware/auth.js:14` | Auth suite status codes |
| `logout` is protected by `auth` middleware in `routes/auth.js:20` — no Bearer token → 401 before controller runs | `routes/auth.js:20` | Logout 401 test goes through middleware, not controller |
| `logout` controller reads cookie but does not require it — no cookie is handled gracefully | `authController.js:132–138` | Logout without cookie → still 200 |
| `getRecipeById` wraps Mongoose in try/catch and returns `500` on error — invalid ObjectId triggers `CastError` → 500, not 400 | `recipeController.js:28–33` | Invalid ObjectId test expects 500 |
| `validate` middleware replaces `req.body` with `result.data` (Zod-parsed output) — unknown fields are stripped | `middleware/validate.js:18` | Extra-field stripping test |
| Nested Zod error paths are joined with `.` (e.g., `ingredients.0.amount`) | `middleware/validate.js:13` | Error field name assertions |
| `recipeUpdateSchema` is `recipeCreateSchema.partial()` — an entirely empty body `{}` is valid | `middleware/validate.js:74` | Empty PATCH body test |
| `server.js` calls `connectDB()` at module load time — tests must prevent this double-connection | `server.js:24` | Global setup must mock or override DB connection |
| Rate limiter: 10 requests per 15-minute window on `/api/auth/register` and `/api/auth/login` | `routes/auth.js:8–17` | Rate limit test must send 11 requests sequentially |
| `usersController.getMe` uses `.select('_id username email')` — password and refreshToken never leave the DB query | `controllers/usersController.js:4` | Field-exclusion test is enforced at DB level |
| `zod` version is `^4.3.6` — Zod v4 API (`.safeParse`, `.partial`) is used | `package.json` | No v3-specific API differences expected |

---

## Global Setup

Every integration test file that imports the Express app must use the following setup pattern. The key constraint is that `server.js` calls `connectDB()` on import. Tests must connect to the in-memory server **before** Mongoose's internal state processes the URI, which requires setting the environment variable before `require('../../../server')`.

### Environment variables

Create `backend/.env.test`:

```
ACCESS_TOKEN_SECRET=test-access-secret
REFRESH_TOKEN_SECRET=test-refresh-secret
NODE_ENV=test
```

Configure Jest to load this file in `backend/package.json`:

```json
"jest": {
  "testEnvironment": "node",
  "transform": {},
  "setupFiles": ["dotenv/config"],
  "testPathPattern": ".*\\.test\\.js$"
}
```

Alternatively, set `DOTENV_CONFIG_PATH=.env.test` or load variables in a `jest.setup.js` file referenced via `"globalSetup"`.

### Shared DB lifecycle pattern

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();         // server.js / connectDB reads this
  // require app AFTER setting URI so connectDB picks up the in-memory URI
  // (see individual suites for timing)
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
```

> **Note:** Because `server.js` calls `connectDB()` synchronously on `require`, the recommended pattern is to start `MongoMemoryServer`, set `process.env.MONGO_URI`, then `require('../../../server')` inside `beforeAll` (using a module-level `let app` variable). This avoids Mongoose attempting to connect to a real URI.

### Token generation helper

Place this in `backend/__tests__/helpers/auth.js` and import it in each suite that needs pre-signed tokens:

```js
const jwt = require('jsonwebtoken');

const ACCESS_SECRET  = process.env.ACCESS_TOKEN_SECRET  || 'test-access-secret';
const REFRESH_SECRET = process.env.REFRESH_TOKEN_SECRET || 'test-refresh-secret';

const generateAccessToken = (userId) =>
  jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '5m' });

const generateExpiredAccessToken = (userId) =>
  jwt.sign({ userId }, ACCESS_SECRET, { expiresIn: '-1s' });  // already expired

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
```

### Minimal valid recipe fixture

Place in `backend/__tests__/helpers/fixtures.js`:

```js
const validRecipe = {
  title: 'Test Pasta',
  ingredients: [{ name: 'Pasta', amount: 200, unit: 'g' }],
};

const validUser = {
  username: 'testuser',
  email: 'test@example.com',
  password: 'password123',
};

module.exports = { validRecipe, validUser };
```

---

## Suite 1 — Auth Middleware

**Test file:** `backend/middleware/__tests__/auth.test.js`
**Tools:** Jest, Supertest, mongodb-memory-server
**What is tested:** The `auth` middleware in isolation, mounted on a minimal Express app created within the test file (no need to import the full server).

**Setup:**

```js
const express = require('express');
const auth = require('../../auth');

// Minimal test app — no DB needed for middleware unit tests
const app = express();
app.use(express.json());
app.use('/protected', auth, (req, res) => {
  res.json({ userId: req.user.userId });
});
```

No DB required. No `beforeAll`/`afterAll` needed beyond creating the app.

### Test cases

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 1 | Missing Authorization header | No `Authorization` header on request | 401 | `response.body.message === 'Authorization header missing or malformed'` |
| 2 | Authorization header without "Bearer " prefix | `Authorization: token abc123` | 401 | `response.body.message === 'Authorization header missing or malformed'` |
| 3 | Authorization header with only "Bearer " (empty token after split) | `Authorization: Bearer ` (trailing space only) | 403 | `response.body.message === 'Invalid or expired token'` — `jwt.verify('')` throws, caught as err in callback |
| 4 | Valid token — req.user populated | `Authorization: Bearer <valid token>` signed with `ACCESS_TOKEN_SECRET`, payload `{ userId: '507f1f77bcf86cd799439011' }` | 200 | `response.body.userId === '507f1f77bcf86cd799439011'`; `next()` was called (evidenced by 200 from downstream handler) |
| 5 | Expired token | `Authorization: Bearer <token signed with expiresIn: '-1s'>` | 403 | `response.body.message === 'Invalid or expired token'` |
| 6 | Tampered token — valid structure, payload altered | Take a valid token string, flip one character in the signature segment | 403 | `response.body.message === 'Invalid or expired token'` |
| 7 | Token signed with wrong secret | `Authorization: Bearer <jwt.sign({ userId }, 'wrong-secret')>` | 403 | `response.body.message === 'Invalid or expired token'` |
| 8 | Valid token — req.user.userId matches payload | Sign token with `{ userId: specificId }` | 200 | `response.body.userId === specificId.toString()` |
| 9 | Authorization header uses uppercase `Authorization` key | Standard fetch/supertest sends lowercase — verify middleware reads `req.headers.Authorization` (case-insensitive in Express) | 200 | Same as case 4; confirms `req.headers.Authorization || req.headers.authorization` fallback |

---

## Suite 2 — Zod Validate Middleware

**Test file:** `backend/middleware/__tests__/validate.test.js`
**Tools:** Jest, Supertest
**What is tested:** The `validate` middleware factory and all exported schemas, in isolation on a minimal Express app. No DB required.

**Setup:**

```js
const express = require('express');
const { validate, registerSchema, loginSchema, recipeCreateSchema, recipeUpdateSchema } = require('../../validate');

function makeApp(schema) {
  const app = express();
  app.use(express.json());
  // Echo req.body back so tests can inspect what reached the controller
  app.post('/test', validate(schema), (req, res) => res.json(req.body));
  return app;
}
```

Create a separate `app` per schema group in `describe` blocks.

### Test cases

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| **validate() core behavior** | | | | |
| 1 | Valid body passes through | Body exactly matching schema requirements | 200 | `response.body` equals the parsed data; `next()` called |
| 2 | Valid body — req.body replaced with parsed data | Send body with a known-coercible value (e.g., `amount: 2` as number) | 200 | `response.body` is the Zod output (`result.data`), not the raw input |
| 3 | Unknown fields are stripped | Send valid required fields plus `extraField: 'hacked'` | 200 | `response.body.extraField === undefined` — Zod strips unknown keys from output |
| 4 | Missing required field — error shape | Omit a required field from an otherwise valid body | 400 | `response.body.message === 'Validation failed.'`; `response.body.errors` is an array; first element has keys `field` (string) and `message` (string) |
| 5 | Wrong type for field — error includes correct field name | Send `amount: 'not-a-number'` for an ingredient | 400 | `response.body.errors` contains an element where `field === 'ingredients.0.amount'` and `message === 'Amount must be a number.'` |
| **registerSchema** | | | | |
| 6 | username too short | `{ username: 'ab', email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'username', message: 'Username must be at least 3 characters.' }` |
| 7 | username too long | `{ username: 'a'.repeat(31), email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'username', message: 'Username must be at most 30 characters.' }` |
| 8 | username with special chars | `{ username: 'user@name', email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'username', message: 'Username may only contain letters, numbers, and underscores.' }` |
| 9 | username with hyphen | `{ username: 'user-name', email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'username', message: 'Username may only contain letters, numbers, and underscores.' }` |
| 10 | username with underscore | `{ username: 'user_name', email: 'a@b.com', password: 'pass123' }` | 200 | Passes validation — underscore is allowed |
| 11 | invalid email format | `{ username: 'validuser', email: 'not-an-email', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'email', message: 'Must be a valid email address.' }` |
| 12 | email missing TLD | `{ username: 'validuser', email: 'user@domain', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'email', message: 'Must be a valid email address.' }` |
| 13 | password too short | `{ username: 'validuser', email: 'a@b.com', password: 'abc' }` | 400 | `response.body.errors` contains `{ field: 'password', message: 'Password must be at least 6 characters.' }` |
| 14 | password exactly 6 chars | `{ username: 'validuser', email: 'a@b.com', password: 'abcdef' }` | 200 | Passes validation |
| 15 | missing username | `{ email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.errors` contains element with `field === 'username'` |
| 16 | missing email | `{ username: 'validuser', password: 'pass123' }` | 400 | `response.body.errors` contains element with `field === 'email'` |
| 17 | missing password | `{ username: 'validuser', email: 'a@b.com' }` | 400 | `response.body.errors` contains element with `field === 'password'` |
| **loginSchema** | | | | |
| 18 | empty username | `{ username: '', password: 'pass123' }` | 400 | `response.body.errors` contains `{ field: 'username', message: 'Username or email is required.' }` |
| 19 | empty password | `{ username: 'testuser', password: '' }` | 400 | `response.body.errors` contains `{ field: 'password', message: 'Password is required.' }` |
| 20 | valid login body | `{ username: 'testuser', password: 'pass123' }` | 200 | `response.body.username === 'testuser'` |
| **recipeCreateSchema** | | | | |
| 21 | missing title | `{ ingredients: [{ name: 'Egg', amount: 2, unit: 'pcs' }] }` | 400 | `response.body.errors` contains element with `field === 'title'` |
| 22 | title too short | `{ title: 'AB', ingredients: [{ name: 'Egg', amount: 2, unit: 'pcs' }] }` | 400 | `response.body.errors` contains `{ field: 'title', message: 'Title must be at least 3 characters.' }` |
| 23 | title exactly 3 chars | `{ title: 'Egg', ingredients: [{ name: 'Egg', amount: 2, unit: 'pcs' }] }` | 200 | Passes validation |
| 24 | empty ingredients array | `{ title: 'Test Recipe', ingredients: [] }` | 400 | `response.body.errors` contains element with `field === 'ingredients'` and message containing 'At least one ingredient' |
| 25 | missing ingredients field | `{ title: 'Test Recipe' }` | 400 | `response.body.errors` contains element with `field === 'ingredients'` |
| 26 | ingredient missing name | `{ title: 'Test', ingredients: [{ amount: 2, unit: 'pcs' }] }` | 400 | `response.body.errors` contains element with `field === 'ingredients.0.name'` and `message === 'Ingredient name is required.'` |
| 27 | ingredient missing unit | `{ title: 'Test', ingredients: [{ name: 'Egg', amount: 2 }] }` | 400 | `response.body.errors` contains element with `field === 'ingredients.0.unit'` and `message === 'Unit is required.'` |
| 28 | ingredient amount is a string | `{ title: 'Test', ingredients: [{ name: 'Egg', amount: 'two', unit: 'pcs' }] }` | 400 | `response.body.errors` contains `{ field: 'ingredients.0.amount', message: 'Amount must be a number.' }` |
| 29 | ingredient amount is zero | `{ title: 'Test', ingredients: [{ name: 'Egg', amount: 0, unit: 'pcs' }] }` | 400 | `response.body.errors` contains element with `field === 'ingredients.0.amount'` and message containing 'positive' |
| 30 | ingredient amount is negative | `{ title: 'Test', ingredients: [{ name: 'Egg', amount: -1, unit: 'pcs' }] }` | 400 | `response.body.errors` contains element with `field === 'ingredients.0.amount'` |
| 31 | invalid category enum | `{ title: 'Test', ingredients: [...], category: 'Brunch' }` | 400 | `response.body.errors` contains element with `field === 'category'` |
| 32 | valid category enum | `{ title: 'Test', ingredients: [...], category: 'Dinner' }` | 200 | `response.body.category === 'Dinner'` |
| 33 | invalid difficulty enum | `{ title: 'Test', ingredients: [...], difficulty: 'Expert' }` | 400 | `response.body.errors` contains element with `field === 'difficulty'` |
| 34 | valid difficulty enum | `{ title: 'Test', ingredients: [...], difficulty: 'Hard' }` | 200 | `response.body.difficulty === 'Hard'` |
| 35 | all optional fields absent | `{ title: 'Test', ingredients: [{ name: 'Egg', amount: 2, unit: 'pcs' }] }` | 200 | Passes — instructions, prepTime, cookTime, servings, tags, notes, difficulty, category all optional |
| **recipeUpdateSchema** | | | | |
| 36 | completely empty body | `{}` | 200 | `response.body` is `{}` — all fields optional via `.partial()` |
| 37 | partial update — title only | `{ title: 'New Title' }` | 200 | `response.body.title === 'New Title'` |
| 38 | invalid category in update | `{ category: 'Invalid' }` | 400 | `response.body.errors` contains element with `field === 'category'` |
| 39 | invalid difficulty in update | `{ difficulty: 'Novice' }` | 400 | `response.body.errors` contains element with `field === 'difficulty'` |
| 40 | unknown field in update body | `{ title: 'Valid', __proto__: 'attack' }` | 200 | `response.body.__proto__` is not the injected string — Zod strips it |

---

## Suite 3 — Auth Controller

**Test file:** `backend/controllers/__tests__/authController.test.js`
**Tools:** Jest, Supertest, mongodb-memory-server
**What is tested:** All four auth endpoints via HTTP through the full Express app stack.

**Setup:**

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');

let mongod;
let app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.ACCESS_TOKEN_SECRET  = 'test-access-secret';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
  // Import app AFTER env vars are set so connectDB uses in-memory URI
  app = require('../../../server');
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
```

> **Rate limiter note:** The `authLimiter` in `routes/auth.js` is a global singleton attached to the Express router. In tests, requests from previous tests may accumulate against the limiter. To prevent this, either: (a) reset the limiter between tests by exporting it and calling `.resetKey()`, or (b) set `max: 1000` via an environment variable, or (c) mock `express-rate-limit`. The rate-limit test (case 26) intentionally triggers the limit — run it in its own `describe` block with the limiter intact.

**Helper used in this suite:**

```js
const User = require('../../../models/User');
const { generateAccessToken, generateRefreshToken } = require('../../helpers/auth');

async function registerUser(overrides = {}) {
  const body = { username: 'testuser', email: 'test@example.com', password: 'password123', ...overrides };
  return request(app).post('/api/auth/register').send(body);
}
```

### Test cases — POST /api/auth/register

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 1 | Valid registration | `{ username: 'testuser', email: 'test@example.com', password: 'password123' }` | 201 | `response.body.accessToken` is a non-empty string; `response.body.user.id` is a non-empty string; `response.body.user.username === 'testuser'`; `response.body.user.email === 'test@example.com'`; `response.body.user.password === undefined` |
| 2 | Valid registration sets refreshToken cookie | Same as case 1 | 201 | `response.headers['set-cookie']` is an array; at least one element starts with `'refreshToken='`; that element contains `'HttpOnly'` |
| 3 | Valid registration stores hashed password in DB | Same as case 1 | 201 | After response: `User.findOne({ username: 'testuser' }).password` does not equal `'password123'`; `password.startsWith('$2b$')` is true (bcrypt hash prefix) |
| 4 | Valid registration stores refreshToken in User document | Same as case 1 | 201 | After response: `User.findOne({ username: 'testuser' }).refreshToken` is a non-null, non-empty string |
| 5 | Duplicate username | Register `testuser` twice with different emails | 400 | `response.body.message === 'User already exists'` |
| 6 | Duplicate email | Register twice with same email, different usernames | 400 | `response.body.message === 'User already exists'` |
| 7 | Missing username | `{ email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.message === 'Validation failed.'`; `response.body.errors` contains element with `field === 'username'` |
| 8 | Missing email | `{ username: 'testuser', password: 'pass123' }` | 400 | `response.body.errors` contains element with `field === 'email'` |
| 9 | Missing password | `{ username: 'testuser', email: 'a@b.com' }` | 400 | `response.body.errors` contains element with `field === 'password'` |
| 10 | Password less than 6 chars | `{ username: 'testuser', email: 'a@b.com', password: 'abc' }` | 400 | `response.body.errors` contains `{ field: 'password', message: 'Password must be at least 6 characters.' }` |
| 11 | Invalid email format | `{ username: 'testuser', email: 'notanemail', password: 'pass123' }` | 400 | `response.body.errors` contains element with `field === 'email'` |
| 12 | Username with special chars | `{ username: 'user@name', email: 'a@b.com', password: 'pass123' }` | 400 | `response.body.errors` contains element with `field === 'username'` and `message === 'Username may only contain letters, numbers, and underscores.'` |

### Test cases — POST /api/auth/login

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 13 | Valid login by username | Register `testuser` first; send `{ username: 'testuser', password: 'password123' }` | 200 | `response.body.accessToken` is a non-empty string; `response.body.user.username === 'testuser'`; `response.body.user.email === 'test@example.com'`; `response.body.user.password === undefined` |
| 14 | Valid login sets refreshToken cookie | Same as case 13 | 200 | `response.headers['set-cookie']` contains element starting with `'refreshToken='` and containing `'HttpOnly'` |
| 15 | Login by email instead of username | Register `testuser`; send `{ username: 'test@example.com', password: 'password123' }` (email in username field) | 200 | `response.body.user.username === 'testuser'` — confirms the `$or: [{ username }, { email: username }]` query works |
| 16 | Wrong password | Register `testuser`; send `{ username: 'testuser', password: 'wrongpassword' }` | 401 | `response.body.message === 'Invalid credentials'` |
| 17 | Non-existent username | No users registered; send `{ username: 'ghost', password: 'pass123' }` | 401 | `response.body.message === 'Invalid credentials'` |
| 18 | Empty password | `{ username: 'testuser', password: '' }` | 400 | `response.body.errors` contains element with `field === 'password'` and `message === 'Password is required.'` |
| 19 | Empty username | `{ username: '', password: 'pass123' }` | 400 | `response.body.errors` contains element with `field === 'username'` and `message === 'Username or email is required.'` |
| 20 | Login updates refreshToken in DB | Register; login; login again | 200 (second login) | `User.findOne({ username: 'testuser' }).refreshToken` equals the token from the second login's `set-cookie` header, not the first login's token |
| 21 | Rate limiting — 11th request in window | Send 11 sequential POST /api/auth/login requests with invalid credentials; the first 10 return 401 | 429 | `response.body.message === 'Too many attempts, please try again after 15 minutes.'` — run in isolated describe block to avoid limiter state contamination |

### Test cases — GET /api/auth/refresh

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 22 | Valid refreshToken cookie | Register user (stores refreshToken in DB and cookie); send GET /api/auth/refresh with that cookie | 200 | `response.body.accessToken` is a non-empty string; `response.body.user.id` is the user's `_id.toString()`; `response.body.user.username === 'testuser'`; `response.body.user.email === 'test@example.com'` |
| 23 | No cookie | GET /api/auth/refresh with no cookies | 401 | Response status is 401 (from `res.sendStatus(401)` — body is the string `'Unauthorized'`) |
| 24 | Cookie token not found in DB | Manually set cookie to a valid JWT signed with `REFRESH_TOKEN_SECRET` but not stored in any User document | 403 | Response status is 403 |
| 25 | Cookie with tampered JWT | Take a valid refresh JWT, flip one character in the signature segment; send as cookie | 403 | Response status is 403 |
| 26 | Cookie with token signed by wrong secret | `jwt.sign({ userId: validId }, 'wrong-secret', { expiresIn: '1d' })` sent as cookie; token IS stored in DB (to pass the `findOne` check) — but JWT verify will still fail | 403 | Response status is 403 — `jwt.verify` with correct `REFRESH_TOKEN_SECRET` fails |
| 27 | Expired refresh token | Register user; manually set `user.refreshToken` in DB to a token signed with `expiresIn: '-1s'`; send that token as cookie | 403 | Response status is 403 — `jwt.verify` callback receives `err` (TokenExpiredError) |
| 28 | userId mismatch between token payload and DB record | Create token with `userId: 'aaaa...0001'`; store it in a User with `_id: 'aaaa...0002'`; send as cookie | 403 | Response status is 403 — `foundUser._id.toString() !== decoded.userId` branch |

### Test cases — POST /api/auth/logout

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 29 | Valid logout — token and cookie both present | Register user (has valid access token + refresh cookie); POST /api/auth/logout with `Authorization: Bearer <accessToken>` and the refreshToken cookie | 200 | `response.body.message === 'Logged out successfully'`; after response: `User.findOne({ username: 'testuser' }).refreshToken === null`; `response.headers['set-cookie']` contains element with `refreshToken=;` (cleared cookie) |
| 30 | No Bearer token | POST /api/auth/logout with no Authorization header | 401 | `response.body.message === 'Authorization header missing or malformed'` — blocked by auth middleware before controller runs |
| 31 | Valid Bearer token but no refreshToken cookie | Register; POST /api/auth/logout with valid access token but no cookie (as if already logged out) | 200 | `response.body.message === 'Logged out successfully'` — controller handles missing cookie gracefully (the `if (refreshToken)` branch is skipped); no DB write occurs |
| 32 | Logout clears cookie in response | Valid logout (case 29 scenario) | 200 | `response.headers['set-cookie']` contains element matching `/refreshToken=;/` and `Expires` (or `Max-Age=0`) indicating cookie deletion |

---

## Suite 4 — Recipe Controller

**Test file:** `backend/controllers/__tests__/recipeController.test.js`
**Tools:** Jest, Supertest, mongodb-memory-server
**What is tested:** All recipe CRUD endpoints and search via HTTP through the full Express app.

**Setup:**

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../../../models/User');
const Recipe = require('../../../models/Recipe');
const { generateAccessToken } = require('../../helpers/auth');

let mongod, app;
let userOneId, userTwoId;
let userOneToken, userTwoToken;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.ACCESS_TOKEN_SECRET  = 'test-access-secret';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
  app = require('../../../server');
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  // Clear collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }

  // Create two distinct users for ownership isolation tests
  const userOne = await User.create({
    username: 'userone',
    email: 'one@example.com',
    password: 'hashedpassword', // pre-hashed not needed for controller tests
  });
  const userTwo = await User.create({
    username: 'usertwo',
    email: 'two@example.com',
    password: 'hashedpassword',
  });

  userOneId    = userOne._id.toString();
  userTwoId    = userTwo._id.toString();
  userOneToken = generateAccessToken(userOneId);
  userTwoToken = generateAccessToken(userTwoId);
});
```

**Shared fixture helper:**

```js
async function createRecipeForUser(userId, overrides = {}) {
  return Recipe.create({
    title: 'Test Recipe',
    ingredients: [{ name: 'Flour', amount: 100, unit: 'g' }],
    user: userId,
    ...overrides,
  });
}
```

### Test cases — GET /api/recipes

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 1 | Returns only requesting user's recipes | Create 2 recipes for userOne, 1 recipe for userTwo; GET with userOne token | 200 | `response.body` is an array of length 2; every element has `user === userOneId`; no element has `user === userTwoId` |
| 2 | Returns empty array when user has no recipes | No recipes in DB; GET with userOne token | 200 | `response.body` is `[]` |
| 3 | Category filter returns only matching recipes | Create recipe with `category: 'Dinner'` and recipe with `category: 'Breakfast'` for userOne; GET `/api/recipes?category=Dinner` | 200 | `response.body` is an array of length 1; `response.body[0].category === 'Dinner'` |
| 4 | Category filter returns empty array for no match | Create recipe with `category: 'Breakfast'` for userOne; GET `/api/recipes?category=Dinner` | 200 | `response.body` is `[]` |
| 5 | Does NOT return other user's recipes | Create recipe for userTwo; GET with userOne token | 200 | `response.body` is `[]` |
| 6 | No auth token | GET /api/recipes with no Authorization header | 401 | `response.body.message === 'Authorization header missing or malformed'` |

### Test cases — GET /api/recipes/search

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 7 | Matches recipe by title | Create recipe `{ title: 'Pasta Bolognese', ... }` for userOne; GET `/api/recipes/search?query=pasta` | 200 | `response.body` is an array of length 1; `response.body[0].title === 'Pasta Bolognese'` |
| 8 | Title match is case-insensitive | Create recipe `{ title: 'PASTA', ... }`; GET `?query=pasta` | 200 | `response.body.length === 1` |
| 9 | Matches recipe by tag | Create recipe `{ title: 'Stew', tags: ['hearty', 'winter'], ... }`; GET `?query=hearty` | 200 | `response.body.length === 1`; `response.body[0].title === 'Stew'` |
| 10 | Returns empty array for no matches | Create recipe `{ title: 'Pasta', ... }`; GET `?query=sushi` | 200 | `response.body` is `[]` |
| 11 | Empty query string returns empty array | GET `/api/recipes/search?query=` | 200 | `response.body` is `[]` — controller short-circuits when `query.trim() === ''` |
| 12 | Query with no `query` param returns empty array | GET `/api/recipes/search` (no `?query=`) | 200 | `response.body` is `[]` |
| 13 | Query with regex special chars does not crash | Create recipe `{ title: 'Pasta', ... }`; GET `?query=pasta.` | 200 | Response is 200 (does not throw 500); `response.body` is `[]` because `'pasta.'` escaped to `'pasta\.'` matches literal dot, not wildcard — confirms ReDoS prevention |
| 14 | Does NOT return another user's matching recipes | Create recipe `{ title: 'Pasta', ... }` for userTwo; GET `/api/recipes/search?query=pasta` with userOne token | 200 | `response.body` is `[]` |

### Test cases — GET /api/recipes/:id

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 15 | Returns recipe for authenticated owner | Create recipe for userOne; GET `/api/recipes/:id` with userOne token | 200 | `response.body._id === recipeId`; `response.body.title === 'Test Recipe'`; `response.body.user === userOneId` |
| 16 | 404 when recipe belongs to another user | Create recipe for userTwo; GET `/api/recipes/:id` with userOne token | 404 | `response.body.message === 'Recipe not found'` — `findOne({ _id, user: userOneId })` returns null because recipe.user is userTwoId |
| 17 | 404 for non-existent recipe ID | Valid ObjectId that does not exist in DB; GET with userOne token | 404 | `response.body.message === 'Recipe not found'` |
| 18 | 500 for invalid ObjectId format | GET `/api/recipes/not-a-valid-id` with userOne token | 500 | `response.body.message` is a non-empty string — Mongoose throws CastError, caught by `catch`, returned as 500 with `error.message` |

### Test cases — POST /api/recipes

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 19 | Valid body creates recipe | POST with userOne token and `{ title: 'New Pasta', ingredients: [{ name: 'Pasta', amount: 200, unit: 'g' }] }` | 201 | `response.body._id` is a non-empty string; `response.body.title === 'New Pasta'`; `response.body.user === userOneId` — confirms user field is set to `req.user.userId` |
| 20 | Created recipe is persisted to DB | Same as case 19 | 201 | After response: `Recipe.findById(response.body._id).user.toString() === userOneId` |
| 21 | Missing title | `{ ingredients: [{ name: 'Egg', amount: 2, unit: 'pcs' }] }` | 400 | `response.body.errors` contains element with `field === 'title'` |
| 22 | Title too short | `{ title: 'AB', ingredients: [...] }` | 400 | `response.body.errors` contains `{ field: 'title', message: 'Title must be at least 3 characters.' }` |
| 23 | Empty ingredients array | `{ title: 'Test', ingredients: [] }` | 400 | `response.body.errors` contains element with `field === 'ingredients'` |
| 24 | Ingredient with non-numeric amount | `{ title: 'Test', ingredients: [{ name: 'Egg', amount: 'two', unit: 'pcs' }] }` | 400 | `response.body.errors` contains `{ field: 'ingredients.0.amount', message: 'Amount must be a number.' }` |
| 25 | Invalid category enum | `{ title: 'Test', ingredients: [...], category: 'Brunch' }` | 400 | `response.body.errors` contains element with `field === 'category'` |
| 26 | Invalid difficulty enum | `{ title: 'Test', ingredients: [...], difficulty: 'Extreme' }` | 400 | `response.body.errors` contains element with `field === 'difficulty'` |
| 27 | XSS payload in title stored as plain string | `{ title: '<script>alert(1)</script>', ingredients: [...] }` | 201 | `response.body.title === '<script>alert(1)</script>'` — backend stores the raw string; no sanitization of angle brackets in recipe title (mongo-sanitize only strips `$` and `.` operators); XSS prevention is a frontend concern |
| 28 | No auth token | POST /api/recipes with no Authorization header | 401 | `response.body.message === 'Authorization header missing or malformed'` |

### Test cases — PATCH /api/recipes/:id

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 29 | Partial update — title only | Create recipe for userOne; PATCH `{ title: 'Updated Title' }` with userOne token | 200 | `response.body.title === 'Updated Title'`; other fields (e.g., `ingredients`) are unchanged from original |
| 30 | Partial update — ingredients only | Create recipe for userOne; PATCH `{ ingredients: [{ name: 'Rice', amount: 150, unit: 'g' }] }` | 200 | `response.body.ingredients[0].name === 'Rice'`; `response.body.title` is unchanged |
| 31 | Cannot update another user's recipe | Create recipe for userTwo; PATCH with userOne token and valid body | 404 | `response.body.message === 'Recipe not found'` — `findOneAndUpdate({ _id, user: userOneId })` returns null |
| 32 | updatedAt changes after PATCH | Create recipe; record `response.body.updatedAt`; wait 1ms; PATCH with any update | 200 | `new Date(response.body.updatedAt) > new Date(originalUpdatedAt)` — confirms Mongoose `timestamps: true` fires on update |
| 33 | Invalid enum value rejected by Zod | PATCH `{ category: 'Lunch' }` — valid; then PATCH `{ category: 'Invalid' }` | 400 | `response.body.errors` contains element with `field === 'category'` |
| 34 | Empty body is valid | Create recipe for userOne; PATCH `{}` with userOne token | 200 | `response.body.title` equals original title; no fields changed — `recipeUpdateSchema.partial()` accepts empty body |
| 35 | No auth token | PATCH with no Authorization header | 401 | `response.body.message === 'Authorization header missing or malformed'` |

### Test cases — DELETE /api/recipes/:id

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 36 | Deletes owned recipe | Create recipe for userOne; DELETE `/api/recipes/:id` with userOne token | 200 | `response.body.message === 'Recipe deleted successfully'`; after response: `Recipe.findById(id) === null` |
| 37 | Cannot delete another user's recipe | Create recipe for userTwo; DELETE with userOne token | 404 | `response.body.message === 'Recipe not found'`; after response: `Recipe.findById(id)` is still non-null (recipe not deleted) |
| 38 | Non-existent recipe | Valid ObjectId not in DB; DELETE with userOne token | 404 | `response.body.message === 'Recipe not found'` |
| 39 | No auth token | DELETE with no Authorization header | 401 | `response.body.message === 'Authorization header missing or malformed'` |

---

## Suite 5 — Users Controller

**Test file:** `backend/controllers/__tests__/usersController.test.js`
**Tools:** Jest, Supertest, mongodb-memory-server
**What is tested:** GET /api/users/me endpoint.

**Setup:**

```js
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const User = require('../../../models/User');
const { generateAccessToken } = require('../../helpers/auth');

let mongod, app;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  process.env.MONGO_URI = mongod.getUri();
  process.env.ACCESS_TOKEN_SECRET  = 'test-access-secret';
  process.env.REFRESH_TOKEN_SECRET = 'test-refresh-secret';
  app = require('../../../server');
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
```

### Test cases — GET /api/users/me

| # | Test name | Input / precondition | Expected status | Expected body / side effect |
|---|-----------|----------------------|-----------------|----------------------------|
| 1 | Returns user data for valid token | Create user in DB; GET /api/users/me with `Authorization: Bearer <generateAccessToken(user._id)>` | 200 | `response.body.id === user._id.toString()`; `response.body.username === 'testuser'`; `response.body.email === 'test@example.com'` |
| 2 | No auth token | GET /api/users/me with no Authorization header | 401 | `response.body.message === 'Authorization header missing or malformed'` — blocked by auth middleware before controller |
| 3 | Response does NOT include password | Same as case 1 | 200 | `response.body.password === undefined` — `.select('_id username email')` excludes password at DB level |
| 4 | Response does NOT include refreshToken | Same as case 1, user has `refreshToken: 'some-token'` stored in DB | 200 | `response.body.refreshToken === undefined` — `.select('_id username email')` excludes refreshToken |
| 5 | Response does NOT include any extra fields | Same as case 1 | 200 | `Object.keys(response.body)` deep-equals `['id', 'username', 'email']` — controller explicitly constructs `{ id, username, email }` response object |
| 6 | Returns 404 for deleted user | Create user; generate token; delete user from DB; GET with that token | 404 | `response.body.message === 'User not found'` — token is still valid but `User.findById` returns null |

---

## File Structure Summary

```
backend/
├── .env.test                                        ← test environment variables
├── __tests__/
│   └── helpers/
│       ├── auth.js                                  ← token generation helpers
│       └── fixtures.js                              ← shared data fixtures
├── middleware/
│   └── __tests__/
│       ├── auth.test.js                             ← Suite 1
│       └── validate.test.js                         ← Suite 2
└── controllers/
    └── __tests__/
        ├── authController.test.js                   ← Suite 3
        ├── recipeController.test.js                 ← Suite 4
        └── usersController.test.js                  ← Suite 5
```

## Known Pitfalls and Implementation Notes

**server.js calls connectDB() at import time.** The test file must set `process.env.MONGO_URI` (or whatever variable `config/db.js` reads) before requiring the app. If Mongoose connects to the real URI before the in-memory URI is set, tests will affect the real database. Use `jest.isolateModules()` or careful import ordering.

**Rate limiter state persists across test cases.** Because `express-rate-limit` stores counts in memory by default, repeated calls to `/api/auth/login` or `/api/auth/register` in the same Jest process will accumulate. Reset the limiter or use a high `max` value (via env var) for all tests except the rate-limit test case.

**`res.sendStatus(401)` and `res.sendStatus(403)`** in the refresh controller send the HTTP status text as the body string (`'Unauthorized'`, `'Forbidden'`) rather than a JSON object. Tests on those endpoints must not assert `response.body.message`; instead assert only `response.status`.

**Mongoose CastError on invalid ObjectId** is caught by the `catch` block in `getRecipeById` and returned as a 500 with `error.message` (the CastError message string). The test must expect 500, not 400.

**`timestamps: true` on Recipe schema** means `createdAt` and `updatedAt` are auto-managed. The PATCH test for `updatedAt` must allow at least 1ms between create and update — use `await new Promise(r => setTimeout(r, 5))` before the PATCH request to guarantee the timestamps differ.

**bcrypt hash prefix** for Node's `bcrypt` package (not `bcryptjs`) uses `$2b$`. The test asserting hashed storage should check `startsWith('$2b$10$')`.

**Zod v4** uses `.safeParse()` which returns `{ success, data, error }`. Error format is `error.errors[]` with `path[]` (array) and `message` (string). The validate middleware maps `path.join('.')` to `field`. Nested paths like `ingredients[0].amount` become `'ingredients.0.amount'` (zero-indexed, dot-separated).
