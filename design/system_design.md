# Recipe App — Master System Design

> This is the authoritative blueprint for the Recipe App. All feature work, component design, API changes, and testing must align with this document. When this document and code diverge, update the code — not this document — unless a deliberate design change has been decided.

---

## Table of Contents

1. [System Overview & Goals](#1-system-overview--goals)
2. [Current State Analysis](#2-current-state-analysis)
3. [Tech Stack Specification](#3-tech-stack-specification)
4. [Data Model](#4-data-model)
5. [API Design](#5-api-design)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Component Registry](#7-component-registry)
8. [Auth Architecture](#8-auth-architecture)
9. [Testing Policy](#9-testing-policy)
10. [Feature Roadmap](#10-feature-roadmap)
11. [Security Checklist](#11-security-checklist)
12. [File & Folder Conventions](#12-file--folder-conventions)

---

## 1. System Overview & Goals

### What this app is

A personal recipe manager with a social layer. Users save, organize, and search their own recipes, and optionally share them with friends.

### MVP Scope (current target)

The MVP is complete when a user can:

1. Register and log in with a username + password
2. Create a recipe with title, ingredients (structured), instructions, times, servings, difficulty, tags, and notes
3. View a list of all their recipes
4. Open a recipe detail page
5. Edit any of their recipes
6. Delete any of their recipes
7. Search their recipes by title or tag
8. Stay logged in across page refreshes (session persistence via cookie)
9. Log out from any page

Everything beyond this — sharing, friends, image uploads, categories, sorting — is post-MVP and documented in [Section 10](#10-feature-roadmap).

### Non-goals (explicitly out of scope for now)

- Public recipe discovery / browsing other users' recipes
- Recipe import from URLs or images
- Meal planning or grocery list generation
- Native mobile app

---

## 2. Current State Analysis

### 2.1 What we have

| Area | Status | Notes |
|------|--------|-------|
| Backend API | **Done** | Express + Mongoose, full recipe CRUD, search endpoint |
| JWT auth | **Done** | Access token (5m) + refresh token (1d, httpOnly cookie) |
| Token refresh / silent retry | **Done** | Axios response interceptor in `AuthContext` |
| Session persistence | **Done** | Refresh-on-mount restores session from cookie |
| React Router | **Done** | v6, all MVP routes wired |
| Protected routes | **Done** | `ProtectedRoute` wraps all authenticated pages |
| Recipe list page | **Done** | Grid layout, search bar, empty state |
| Recipe detail page | **Done** | Two-column layout, meta pills, tags, delete |
| Create recipe | **Done** | Full `RecipeForm` with dynamic ingredients + steps |
| Edit recipe | **Done** | `RecipeForm` pre-populated, PATCH to backend |
| Tailwind v4 theme | **Done** | Earth tones: sage, cream, terracotta in `index.css` |
| Design tokens | **Done** | `btn-primary/secondary/danger/ghost`, `.input`, `.card`, `.page`, `.field-label` |

### 2.2 What to fix

These are bugs or UX gaps in the existing implementation that must be resolved before or alongside any new feature work.

#### BUG-001 — Username not shown in NavBar after session restore

**Where:** `AuthContext.jsx:25`, `NavBar.jsx:36`

**Problem:** On mount, `AuthContext` calls `/auth/refresh` and decodes only `userId` from the JWT payload. The JWT does not contain `username`, so `user.username` is `undefined`. The NavBar displays "Account" instead of the real username.

**Fix:** Either (a) include `username` in the JWT payload when signing, or (b) after a successful refresh, make a `GET /api/users/me` call to fetch the full user profile and populate `AuthContext` state.

Recommended: option (b) — keeps JWTs minimal and allows the profile to include future fields.

#### BUG-002 — Login accepts username but register asks for email

**Where:** `LoginPage.jsx`, `RegisterPage.jsx`, `authController.js:68`

**Problem:** Register collects `username + email + password`. Login only uses `username + password`. Users who forget their username and try logging in with email will get "Invalid credentials" with no explanation.

**Fix:** Support email login on the backend (`User.findOne({ $or: [{ username }, { email: username }] })`), or add clear copy on the login page: "Sign in with your username, not your email."

#### BUG-003 — No frontend password validation rules

**Where:** `RegisterPage.jsx`

**Problem:** The form enforces `minLength={6}` but shows no rules to the user. The error message on failure is generic.

**Fix:** Add a password hint below the input field: "At least 6 characters."

#### BUG-004 — Search is not cleared when navigating away and back

**Where:** `RecipesPage.jsx`

**Problem:** If a user searches, then navigates to a detail page, then comes back, the search state resets (local component state) but the URL does not reflect the search query. This is inconsistent.

**Fix:** Persist search query in the URL as `?q=` so the browser back button works correctly and the list reflects the active filter.

#### BUG-005 — Delete uses `window.confirm()`

**Where:** `RecipeDetailPage.jsx:26`

**Problem:** `window.confirm()` is a blocking native dialog, visually inconsistent with the app's design system.

**Fix:** Replace with a styled inline confirmation (e.g. the button changes to "Are you sure? [Confirm] [Cancel]") or a modal.

#### BUG-006 — `updatedAt` not refreshed on PATCH

**Where:** `recipeController.js:50`

**Problem:** `findOneAndUpdate` with `req.body` bypasses Mongoose middleware, so the `pre('save')` hook that updates `updatedAt` does not run.

**Fix:** Either use `{ timestamps: true }` on the schema (and remove the manual hook), or call `.save()` on the fetched document instead of `findOneAndUpdate`.

### 2.3 Missing Features

| Feature | Priority | Section |
|---------|----------|---------|
| `GET /api/users/me` endpoint | High | [10.1](#101-user-profile-endpoint) |
| Image upload per recipe | Medium | [10.2](#102-image-uploads) |
| Category field + filter | Medium | [10.3](#103-category-and-sorting) |
| Sort controls on recipe list | Medium | [10.3](#103-category-and-sorting) |
| Friends / social system | Low | [10.4](#104-friends--social) |
| Recipe sharing | Low | [10.5](#105-recipe-sharing) |
| Rate limiting on auth routes | High (security) | [11](#11-security-checklist) |
| Input validation middleware | High (security) | [11](#11-security-checklist) |
| Security headers (helmet) | Medium (security) | [11](#11-security-checklist) |

---

## 3. Tech Stack Specification

### 3.1 Frontend

| Technology | Version | Role |
|------------|---------|------|
| React | 18.3 | UI framework |
| Vite | 6.0 | Build tool + dev server (port 3000) |
| react-router-dom | 6.28 | Client-side routing |
| Tailwind CSS | 4.2 | Utility-first CSS, configured in `index.css` via `@theme` |
| Axios | 1.7 | HTTP client |

**Key frontend rules:**
- All files containing JSX **must** use `.jsx` extension. Vite 6 (Rollup) does not parse JSX in `.js` files.
- `App.js` and `index.js` are empty stubs for legacy compatibility — all real logic lives in `App.jsx` and `main.jsx`.
- Tailwind v4: no `tailwind.config.js`. All theme tokens are defined in `index.css` under `@theme { }`.

### 3.2 Backend

| Technology | Version | Role |
|------------|---------|------|
| Node.js | LTS | Runtime |
| Express | 4.21 | HTTP framework |
| Mongoose | 8.9 | ODM for MongoDB |
| bcrypt | 5.1 | Password hashing (cost factor 10) |
| jsonwebtoken | 9.0 | JWT signing + verification |
| cookie-parser | 1.4 | Parse `refreshToken` httpOnly cookie |
| cors | 2.8 | CORS locked to `http://localhost:3000` |
| dotenv | 16.4 | Environment variable loading |
| nodemon | 3.1 | Dev auto-restart |

**Environment variables required (`.env` in `backend/`):**
```
PORT=5000
MONGO_URI=<your MongoDB URI>
ACCESS_TOKEN_SECRET=<random 64-byte hex>
REFRESH_TOKEN_SECRET=<random 64-byte hex>
NODE_ENV=development
```

### 3.3 Auth

- **Access token:** JWT, signed with `ACCESS_TOKEN_SECRET`, expires in 5 minutes, returned in response body only, stored in a React `useRef` (never localStorage or sessionStorage)
- **Refresh token:** JWT, signed with `REFRESH_TOKEN_SECRET`, expires in 1 day, stored in an `httpOnly; SameSite=Strict` cookie, and persisted in `User.refreshToken` in the database
- **Token rotation:** On each successful `/auth/refresh`, the old refresh token is replaced in the database (single active session per user)
- **Silent refresh:** Axios response interceptor catches 401s, calls `/auth/refresh`, retries the original request — fully transparent to the user

---

## 4. Data Model

### 4.1 User

```
User {
  _id:          ObjectId
  username:     String    required, unique, trimmed
  email:        String    required, unique, lowercase
  password:     String    bcrypt hash
  refreshToken: String    nullable — current active refresh token
  role:         ObjectId  ref: Role, nullable (not yet enforced)
  createdAt:    Date      auto (timestamps: true)
  updatedAt:    Date      auto (timestamps: true)
}
```

**Planned additions (post-MVP):**
```
  friends:        [ObjectId]   ref: User
  friendRequests: [{
    from:   ObjectId  ref: User
    status: Enum      'pending' | 'accepted' | 'declined'
  }]
```

### 4.2 Recipe

```
Recipe {
  _id:          ObjectId
  user:         ObjectId   ref: User, required — ownership
  title:        String     required, minLength 3
  ingredients:  [{
    name:   String  required
    amount: Number  required
    unit:   String  required
  }]
  instructions: [String]
  prepTime:     Number     minutes
  cookTime:     Number     minutes
  servings:     Number
  tags:         [String]   text-indexed
  difficulty:   Enum       'Easy' | 'Medium' | 'Hard'  default: 'Medium'
  notes:        String
  source:       String     default: 'Custom'
  sourceUrl:    String
  sourceImage:  String
  createdAt:    Date       immutable
  updatedAt:    Date       updated by pre('save') hook
}

Indexes: { title: 'text', tags: 'text' }
```

**Planned additions (post-MVP):**
```
  category:    Enum       'Breakfast'|'Lunch'|'Dinner'|'Snack'|'Dessert'|'Drink'|'Other'
  imageUrl:    String     uploaded image (Cloudinary or local)
  isPublic:    Boolean    default: false
  sharedWith:  [ObjectId] ref: User
  likes:       [ObjectId] ref: User
```

---

## 5. API Design

### 5.1 Auth endpoints

```
POST   /api/auth/register     → { accessToken, user: {id, username, email} } + cookie
POST   /api/auth/login        → { accessToken, user: {id, username, email} } + cookie
GET    /api/auth/refresh      → { accessToken }                                (cookie required)
POST   /api/auth/logout       → { message }                                    (Bearer required)
```

**Planned (BUG-001 fix):**
```
GET    /api/users/me          → { id, username, email }                        (Bearer required)
```

### 5.2 Recipe endpoints

All require `Authorization: Bearer <accessToken>`. All queries are scoped to `req.user.userId`.

```
GET    /api/recipes                    → Recipe[]     all recipes for this user
GET    /api/recipes/search?query=      → Recipe[]     regex match on title + tags
GET    /api/recipes/:id                → Recipe
POST   /api/recipes                    → Recipe       body: RecipePayload
PATCH  /api/recipes/:id                → Recipe       body: Partial<RecipePayload>
DELETE /api/recipes/:id                → { message }
```

**Planned (post-MVP):**
```
GET    /api/recipes?category=&sort=&order=   → Recipe[]   filtered + sorted
GET    /api/recipes?ingredients=a,b          → Recipe[]   ingredient filter
POST   /api/recipes/:id/share                → { message } body: { userId }
GET    /api/recipes/shared                   → Recipe[]   shared with current user
DELETE /api/recipes/:id/share/:userId        → { message }
```

### 5.3 Users endpoints (planned)

```
GET    /api/users/me                         → User profile
GET    /api/users/search?username=           → User[]
POST   /api/users/friends/request            → { message } body: { username }
PATCH  /api/users/friends/request/:userId    → { message } body: { action: 'accept'|'decline' }
GET    /api/users/friends                    → User[]
DELETE /api/users/friends/:userId            → { message }
```

### 5.4 Request / Response conventions

- All bodies are JSON (`Content-Type: application/json`)
- Success: HTTP 200/201 with data payload
- Validation error: HTTP 400 `{ message: string }`
- Auth error: HTTP 401 (missing/expired token), 403 (invalid token or refresh mismatch)
- Not found: HTTP 404 `{ message: string }`
- Server error: HTTP 500 `{ message: 'Internal Server Error' }` (never expose stack traces)

---

## 6. Frontend Architecture

### 6.1 Directory structure

```
frontend/src/
├── api/
│   ├── axios.js          Two Axios instances: publicAxios + axiosInstance
│   ├── authApi.js        login, register, refresh, logout
│   ├── recipesApi.js     getAllRecipes, getRecipeById, createRecipe, updateRecipe,
│   │                     deleteRecipe, searchRecipes
│   └── usersApi.js       (planned) getMe, searchUsers, friends CRUD
├── context/
│   └── AuthContext.jsx   Session state, token ref, request/response interceptors
├── hooks/
│   └── useAuth.js        useContext(AuthContext) wrapper
├── pages/
│   ├── LoginPage.jsx
│   ├── RegisterPage.jsx
│   ├── RecipesPage.jsx
│   ├── RecipeDetailPage.jsx
│   ├── CreateRecipePage.jsx
│   ├── EditRecipePage.jsx
│   ├── FriendsPage.jsx       (planned)
│   └── SharedWithMePage.jsx  (planned)
├── components/
│   ├── ProtectedRoute.jsx
│   ├── NavBar.jsx
│   ├── RecipeCard.jsx
│   ├── RecipeForm.jsx
│   ├── SearchBar.jsx         (planned — extract from RecipesPage)
│   ├── CategoryFilter.jsx    (planned)
│   ├── SortControls.jsx      (planned)
│   ├── ConfirmDialog.jsx     (planned — replace window.confirm)
│   ├── ShareModal.jsx        (planned)
│   └── ImageUpload.jsx       (planned)
├── index.css             Tailwind v4 @theme + component classes
├── App.jsx               Router + AuthProvider
└── main.jsx              React DOM root
```

### 6.2 Route table

| Path | Component | Auth | Notes |
|------|-----------|------|-------|
| `/login` | `LoginPage` | Public | Redirects to `/recipes` if already authed |
| `/register` | `RegisterPage` | Public | |
| `/recipes` | `RecipesPage` | Protected | Search via `?q=` query param |
| `/recipes/new` | `CreateRecipePage` | Protected | |
| `/recipes/:id` | `RecipeDetailPage` | Protected | |
| `/recipes/:id/edit` | `EditRecipePage` | Protected | |
| `/friends` | `FriendsPage` | Protected | Planned |
| `/shared` | `SharedWithMePage` | Protected | Planned |
| `*` | — | — | Redirect to `/recipes` |

### 6.3 State management

No global state library (Redux, Zustand, etc.) is used or planned. State is managed as:

- **Auth state** (`user`, `loading`) — `AuthContext`, consumed via `useAuth()`
- **Access token** — `useRef` inside `AuthContext` (not React state, avoids re-renders)
- **Page-local data** (recipe list, single recipe, form state) — `useState` + `useEffect` per page
- **URL state** — search query in `?q=` param (to be implemented per BUG-004)

---

## 7. Component Registry

Every component listed here **must have a corresponding design file** at `design/components/<ComponentName>.md` before implementation begins. The design file specifies: props interface, behavior, states, and design token usage.

### Currently implemented

| Component | File | Design file |
|-----------|------|-------------|
| `NavBar` | `components/NavBar.jsx` | `design/components/NavBar.md` |
| `ProtectedRoute` | `components/ProtectedRoute.jsx` | `design/components/ProtectedRoute.md` |
| `RecipeCard` | `components/RecipeCard.jsx` | `design/components/RecipeCard.md` |
| `RecipeForm` | `components/RecipeForm.jsx` | `design/components/RecipeForm.md` |

### Planned components

| Component | File | Design file | Purpose |
|-----------|------|-------------|---------|
| `SearchBar` | `components/SearchBar.jsx` | `design/components/SearchBar.md` | Extract search input + submit from `RecipesPage`. Drives `?q=` URL param. |
| `CategoryFilter` | `components/CategoryFilter.jsx` | `design/components/CategoryFilter.md` | Tab or pill group for recipe category filtering |
| `SortControls` | `components/SortControls.jsx` | `design/components/SortControls.md` | Dropdown to sort recipe list by `title`, `prepTime`, `cookTime`, `createdAt` |
| `ConfirmDialog` | `components/ConfirmDialog.jsx` | `design/components/ConfirmDialog.md` | Inline styled replacement for `window.confirm()`. Used for delete, unfriend, etc. |
| `ShareModal` | `components/ShareModal.jsx` | `design/components/ShareModal.md` | Modal to search friends and share a recipe with them |
| `ImageUpload` | `components/ImageUpload.jsx` | `design/components/ImageUpload.md` | File picker + preview for recipe cover image |
| `FriendCard` | `components/FriendCard.jsx` | `design/components/FriendCard.md` | Shows a friend's username + pending/accepted status |
| `Toast` | `components/Toast.jsx` | `design/components/Toast.md` | Non-blocking feedback notification (success/error) to replace inline error `<p>` elements |

### Component design file format

Each `design/components/<Name>.md` file must follow this structure:

```markdown
# ComponentName

## Purpose
One sentence.

## Props
| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|

## States
List all visual/data states: loading, empty, error, populated, etc.

## Behavior
Describe interactions, events emitted, navigation side-effects.

## Design tokens used
List the Tailwind classes / theme tokens from index.css.

## Test cases
List at minimum: renders without crash, renders each state, key interactions.
```

---

## 8. Auth Architecture

### 8.1 Token lifecycle

```
Register / Login
  │
  ├─► Backend: hash password (bcrypt cost 10)
  ├─► Generate accessToken  (JWT, 5m, ACCESS_TOKEN_SECRET)
  ├─► Generate refreshToken (JWT, 1d, REFRESH_TOKEN_SECRET)
  ├─► Store refreshToken in User.refreshToken (DB)
  ├─► Set cookie: refreshToken (httpOnly, SameSite=Strict, maxAge=1d)
  └─► Response body: { accessToken, user: {id, username, email} }

Frontend (AuthContext)
  │
  ├─► Store accessToken in useRef (not state, not localStorage)
  ├─► Store user object in useState
  ├─► Axios request interceptor: attach Authorization: Bearer <token>
  └─► Axios response interceptor:
        on 401 and not already retried and not a /refresh call:
          │
          ├─► Call GET /api/auth/refresh (sends cookie automatically)
          ├─► Store new accessToken in ref
          └─► Retry original request

Page load (session restore)
  │
  └─► AuthContext useEffect → GET /api/auth/refresh
        ├─► success: set token + user, setLoading(false)
        └─► failure: user stays null, setLoading(false) → redirect to login

Logout
  │
  ├─► POST /api/auth/logout (clears User.refreshToken in DB, clears cookie)
  ├─► Clear tokenRef
  └─► Clear user state → redirect to login
```

### 8.2 Auth middleware (`backend/middleware/auth.js`)

1. Read `Authorization` header
2. Require `Bearer ` prefix — return 401 if missing or malformed
3. `jwt.verify(token, ACCESS_TOKEN_SECRET)` — return 403 if invalid or expired
4. Set `req.user = { userId: decoded.userId }`
5. Call `next()`

### 8.3 Where auth middleware is applied

- Applied once in `server.js` for the entire `/api/recipes` router
- Applied per-route in `routes/auth.js` for `POST /logout` only
- **Not** applied to `/api/auth/register`, `/api/auth/login`, `/api/auth/refresh`

---

## 9. Testing Policy

### 9.1 Philosophy

This project follows a **test-driven** approach for all new feature work:

1. Write the test first (or immediately alongside)
2. Implement until the test passes
3. Refactor — tests must remain green

Existing code without tests must have tests added before any modification to that code.

### 9.2 Testing tools

| Layer | Tool | Config file |
|-------|------|-------------|
| Frontend unit + component | Vitest + React Testing Library | `frontend/vitest.config.js` |
| Backend unit | Jest | `backend/jest.config.js` |
| E2E | Playwright | `e2e/playwright.config.js` |

**Install (frontend):**
```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom
```

**Install (backend):**
```bash
npm install -D jest @jest/globals supertest mongodb-memory-server
```

**Install (E2E):**
```bash
npm install -D @playwright/test
```

### 9.3 Frontend unit testing

**Coverage targets:**
- All API modules (`api/*.js`) — mock axios, verify correct URL, method, and payload
- All utility functions — `toFormState`, `toPayload` in `RecipeForm`
- All React components — each must have a test file at `src/components/__tests__/<Name>.test.jsx` and `src/pages/__tests__/<Name>.test.jsx`

**Every component test must cover:**
1. Renders without crashing (smoke test)
2. Renders each named state (loading, empty, error, populated)
3. Key user interactions (clicks, form submissions, navigation)
4. Accessibility: key interactive elements have accessible labels

**Example component test structure:**
```js
// RecipeCard.test.jsx
describe('RecipeCard', () => {
  it('renders the recipe title', () => { ... });
  it('shows difficulty badge', () => { ... });
  it('shows total time when prepTime and cookTime are set', () => { ... });
  it('hides time row when neither time is set', () => { ... });
  it('links to the recipe detail page', () => { ... });
  it('shows up to 4 tags', () => { ... });
});
```

**Mocking conventions:**
- Mock `react-router-dom` with `MemoryRouter` wrapper in tests
- Mock `../api/recipesApi` with `vi.mock()`
- Mock `../hooks/useAuth` to return a controlled user state

### 9.4 Backend unit testing

**Coverage targets:**
- All controller functions in `authController.js` and `recipeController.js`
- Auth middleware in `middleware/auth.js`

**Rules:**
- Use `mongodb-memory-server` for all DB tests — never connect to a real database in tests
- Each controller test covers: success path, not found, auth failure, validation failure
- Test files live at `backend/controllers/__tests__/` and `backend/middleware/__tests__/`

**Example backend test structure:**
```js
// recipeController.test.js
describe('createRecipe', () => {
  it('creates a recipe and returns 201', async () => { ... });
  it('returns 400 when title is missing', async () => { ... });
  it('scopes the recipe to req.user.userId', async () => { ... });
});

describe('deleteRecipe', () => {
  it('deletes owned recipe and returns 200', async () => { ... });
  it('returns 404 when recipe belongs to another user', async () => { ... });
});
```

### 9.5 End-to-end testing

E2E tests run against the full stack (real backend + real frontend in a test browser).

**Test environment:**
- Backend uses a dedicated test MongoDB instance (via `mongodb-memory-server` or a separate test DB)
- Frontend dev server on port 3000
- Backend on port 5000

**Mandatory E2E test suites:**

| Suite | Scenarios |
|-------|-----------|
| **Auth** | Register → lands on /recipes; Login → lands on /recipes; Bad credentials → shows error; Logout → redirects to /login; Page refresh → stays logged in |
| **Recipe CRUD** | Create recipe → appears in list; Edit recipe → changes reflected on detail page; Delete recipe → removed from list |
| **Search** | Search by title → matching recipes shown; Search by tag → matching recipes shown; Clear search → all recipes restored |
| **Navigation** | Unauthenticated visit to /recipes → redirected to /login; Direct URL to /recipes/:id requires auth |

**E2E test file locations:** `e2e/<suite>.spec.ts`

### 9.6 Test scripts

Add to `package.json`:

```json
"scripts": {
  "test":         "vitest run",
  "test:watch":   "vitest",
  "test:coverage":"vitest run --coverage",
  "test:e2e":     "playwright test"
}
```

Backend:
```json
"scripts": {
  "test": "jest --runInBand"
}
```

### 9.7 What does NOT need tests

- `main.jsx` — React DOM entry point
- `App.jsx` — route wiring (covered by E2E)
- `index.css` — CSS
- Config files

---

## 10. Feature Roadmap

### 10.1 User profile endpoint

**Priority: High (fixes BUG-001)**

Add `GET /api/users/me` to the backend. After a successful session restore (refresh), `AuthContext` calls this endpoint to populate `user.username` in state.

Backend: new `usersController.js` + `routes/users.js`
Frontend: add `getMe()` to `api/usersApi.js`, call it in `AuthContext` after refresh

### 10.2 Image uploads

Recipe cover images. Each recipe can have one image.

**Backend:**
- Add `imageUrl: String` to Recipe schema
- Add `POST /api/recipes/:id/image` endpoint
- Store images with Cloudinary (production) or `multer` + local disk (development)

**Frontend:**
- `ImageUpload` component (see [Component Registry](#7-component-registry))
- Add image display to `RecipeCard` and `RecipeDetailPage`

### 10.3 Category and sorting

**Backend:**
- Add `category: Enum` to Recipe schema: `Breakfast | Lunch | Dinner | Snack | Dessert | Drink | Other`
- Extend `GET /api/recipes` to accept `?category=&sort=&order=`
- Extend `searchRecipes` to accept `?ingredients=` (comma-separated ingredient names)

**Frontend:**
- `CategoryFilter` component: pill/tab group above the recipe grid
- `SortControls` component: dropdown for sort field + order
- Persist active filters in URL params

### 10.4 Friends / social

**Backend:**
- Add `friends: [ObjectId]` and `friendRequests: [{from, status}]` to User schema
- New routes: `POST /request`, `PATCH /request/:id`, `GET /friends`, `DELETE /friends/:id`, `GET /search`

**Frontend:**
- `FriendsPage`: list friends, pending requests, search for users
- `FriendCard` component

### 10.5 Recipe sharing

Depends on friends feature being complete.

**Backend:**
- Add `isPublic: Boolean` and `sharedWith: [ObjectId]` to Recipe schema
- `GET /api/recipes` must return: `{ user: me } OR { sharedWith: me }`
- New endpoints: share, unshare, list shared-with-me

**Frontend:**
- `ShareModal` component: search friends, select, submit share
- `SharedWithMePage`: grid of recipes shared with the current user

---

## 11. Security Checklist

| Control | Status | Action |
|---------|--------|--------|
| Passwords hashed with bcrypt (cost 10) | Done | — |
| Access tokens short-lived (5m) | Done | — |
| Refresh tokens in httpOnly cookie | Done | — |
| Refresh token rotation (single active session) | Done | — |
| Regex input escaped in search (ReDoS prevention) | Done | — |
| CORS restricted to `localhost:3000` | Done (dev) | Lock to prod domain on deploy |
| `secure: true` on cookie in production | Done (conditional) | Verify `NODE_ENV=production` is set on deploy |
| Rate limiting on auth routes | **Missing** | Add `express-rate-limit` to `/api/auth/login` and `/api/auth/register` |
| Input validation middleware | **Missing** | Add `express-validator` or `zod` to all POST/PATCH routes |
| Security headers | **Missing** | Add `helmet` in `server.js` |
| MongoDB injection protection | **Missing** | Add `express-mongo-sanitize` |
| No stack traces in error responses | Done | Global error handler returns generic message |
| Tokens never in localStorage | Done | Access token in `useRef` only |

---

## 12. File & Folder Conventions

### Naming

| Item | Convention | Example |
|------|------------|---------|
| React components | PascalCase `.jsx` | `RecipeCard.jsx` |
| Pages | PascalCase + `Page` suffix | `RecipesPage.jsx` |
| Hooks | camelCase + `use` prefix | `useAuth.js` |
| API modules | camelCase + `Api` suffix | `recipesApi.js` |
| Backend controllers | camelCase + `Controller` suffix | `recipeController.js` |
| Backend routes | camelCase | `recipes.js` |
| Test files | Same name + `.test.jsx` / `.test.js` | `RecipeCard.test.jsx` |
| E2E test files | kebab-case + `.spec.ts` | `recipe-crud.spec.ts` |
| Design files | PascalCase `.md` in `design/components/` | `RecipeCard.md` |

### Import order (frontend)

1. React and React hooks
2. Third-party libraries (react-router-dom, axios)
3. Context and hooks (`../context/`, `../hooks/`)
4. API modules (`../api/`)
5. Components (`../components/`)
6. Relative imports / local files

### CSS approach

- **Never write inline styles.** Use Tailwind utility classes.
- **Never add new utility classes directly in JSX for patterns used more than once.** Extract into a named class in `index.css` using `@layer components`.
- The existing design tokens (sage, cream, terracotta) are the only color palette. Do not introduce new colors without updating this document.
