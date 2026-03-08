# Recipe App — Design Document

## Overview

A full-stack recipe management application. Users register, log in, and manage a personal collection of recipes. The app supports full CRUD on recipes and basic text search by title and tags.

**Stack:** React 18 (frontend) · Node/Express (backend) · MongoDB via Mongoose (database)

---

## Architecture

```
recipe-app/
├── backend/          Node/Express API server
│   ├── config/       DB connection (db.js)
│   ├── controllers/  Business logic (authController.js, recipeController.js)
│   ├── middleware/   JWT auth guard (auth.js)
│   ├── models/       Mongoose schemas (User.js, Recipe.js)
│   ├── routes/       Express routers (auth.js, recipes.js)
│   └── server.js     Entry point — CORS, middleware, route mounting
└── frontend/         React SPA (Vite 6)
    └── src/
        ├── api/      HTTP layer (axios.js, authApi.js, recipesApi.js)
        ├── context/  AuthContext.jsx — session state + token management
        ├── hooks/    useAuth.js
        ├── pages/    Full-page route components
        └── components/ Shared UI components
```

---

## Backend

### Entry Point — `server.js`

- CORS locked to `http://localhost:3000` with `credentials: true`
- `express.json()` + `cookie-parser` middleware
- Auth middleware applied once at route mount level: `app.use('/api/recipes', authenticate, recipesRouter)`
- Global error handler returns `500` with a generic message

### Auth Routes — `POST/GET /api/auth/*`

| Method | Path | Handler | Auth required |
|--------|------|---------|---------------|
| POST | `/api/auth/register` | `register` | No |
| POST | `/api/auth/login` | `login` | No |
| GET | `/api/auth/refresh` | `refresh` | No (cookie) |
| POST | `/api/auth/logout` | `logout` | Bearer token |

### Recipe Routes — `/api/recipes/*`

All routes require a valid Bearer access token (enforced at the router level).

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/recipes` | `getAllRecipes` |
| GET | `/api/recipes/search?query=` | `searchRecipes` |
| GET | `/api/recipes/:id` | `getRecipeById` |
| POST | `/api/recipes` | `createRecipe` |
| PATCH | `/api/recipes/:id` | `updateRecipe` |
| DELETE | `/api/recipes/:id` | `deleteRecipe` |

All recipe queries are scoped to `req.user.userId` — users can only access their own recipes.

---

## Data Models

### User (`models/User.js`)

| Field | Type | Notes |
|-------|------|-------|
| `email` | String | Required, unique, lowercase |
| `password` | String | bcrypt hash (cost 10) |
| `username` | String | Required, unique |
| `role` | ObjectId (ref Role) | Nullable — not yet enforced |
| `refreshToken` | String | Single active refresh token per user |
| `createdAt`, `updatedAt` | Date | Mongoose `timestamps: true` |

### Recipe (`models/Recipe.js`)

| Field | Type | Notes |
|-------|------|-------|
| `title` | String | Required, min 3 chars |
| `user` | ObjectId (ref User) | Required — ownership |
| `ingredients` | `[{name, amount, unit}]` | All subfields required |
| `instructions` | `[String]` | Ordered steps |
| `prepTime`, `cookTime` | Number | Minutes |
| `servings` | Number | |
| `tags` | `[String]` | Text-indexed for search |
| `difficulty` | Enum: Easy/Medium/Hard | Default: Medium |
| `notes` | String | Optional free text |
| `source`, `sourceUrl`, `sourceImage` | String | Provenance metadata |
| `createdAt` | Date | Immutable |
| `updatedAt` | Date | Auto-updated in `pre('save')` hook |

**MongoDB text index** on `title` + `tags` (also used for regex search fallback).

---

## Authentication & Token Flow

```
Browser                          Backend
  |                                 |
  |-- POST /auth/login ------------>|
  |<-- { accessToken } + cookie ----|  (refreshToken in httpOnly cookie)
  |                                 |
  |-- GET /api/recipes              |
  |   Authorization: Bearer <at> -->|
  |<-- recipes ----------------------|
  |                                 |
  |  [access token expires ~5min]   |
  |                                 |
  |-- GET /auth/refresh (cookie) -->|
  |<-- { accessToken } -------------|  (refresh token rotated in DB)
```

- **Access tokens:** JWT, 5-minute expiry, signed with `ACCESS_TOKEN_SECRET`, carried in-memory only (React ref, not localStorage)
- **Refresh tokens:** JWT, 1-day expiry, signed with `REFRESH_TOKEN_SECRET`, stored as `httpOnly; SameSite=Strict` cookie and persisted in `User.refreshToken`
- **Token rotation:** Each `/auth/refresh` call issues a new access token (refresh token itself is not rotated)
- **Auth middleware (`middleware/auth.js`):** Extracts `Authorization: Bearer <token>`, verifies signature, sets `req.user = { userId }`

---

## Frontend

### Routing (`App.jsx`)

```
/login                → LoginPage       (public)
/register             → RegisterPage    (public)
/recipes              → RecipesPage     (protected)
/recipes/new          → CreateRecipePage (protected)
/recipes/:id          → RecipeDetailPage (protected)
/recipes/:id/edit     → EditRecipePage  (protected)
*                     → redirect to /recipes
```

`ProtectedRoute` wraps protected pages — redirects to `/login` if unauthenticated, and renders `NavBar` around the page content.

### Session Management (`context/AuthContext.jsx`)

- On mount: calls `/auth/refresh` to restore session from cookie; sets `tokenRef` and `user` state
- Token stored in a `useRef` (not state) so axios interceptors can read it without re-registering
- **Request interceptor:** attaches `Authorization: Bearer <token>` to every `axiosInstance` request
- **Response interceptor:** on 401, attempts a silent token refresh and retries the original request; on failure, clears session and the user is effectively logged out

### HTTP Layer (`api/`)

Two axios instances:
- **`publicAxios`** — used by `authApi.js` for login/register/refresh; no interceptors
- **`axiosInstance`** (default export) — used by `recipesApi.js` for all protected calls; interceptors attached by `AuthContext`

`recipesApi.js` exposes: `getAllRecipes`, `getRecipeById`, `createRecipe`, `updateRecipe`, `deleteRecipe`, `searchRecipes`.

### Key Components

**`RecipeForm`** — shared create/edit form:
- Manages dynamic ingredient rows (`[{name, amount, unit}]`) and instruction steps
- `toFormState(data)` converts API data to form state (tags array → comma string)
- `toPayload(form)` converts form state back to API payload (comma string → tags array, strings → numbers)
- Used by both `CreateRecipePage` and `EditRecipePage`

**`NavBar`** — top navigation with links and logout button

**`RecipeCard`** — summary card used in the recipe list

---

## Security

| Control | Status |
|---------|--------|
| Passwords hashed with bcrypt (cost 10) | Done |
| Access tokens short-lived (5m) | Done |
| Refresh token in httpOnly cookie (not localStorage) | Done |
| Regex input escaped in search (ReDoS prevention) | Done |
| CORS restricted to frontend origin | Done (dev) |
| Rate limiting on auth routes | Not yet |
| Input validation middleware | Not yet |
| Security headers (helmet) | Not yet |
| MongoDB injection protection (mongo-sanitize) | Not yet |

---

## Planned Features

### 1. Search & Filter
- Ingredient-based search: `GET /api/recipes/search?ingredients=tomato,garlic`
- Category filter: `GET /api/recipes?category=Dinner`
- Sort: `?sort=prepTime&order=asc`
- Add `category` enum field to Recipe schema

### 2. Recipe Sharing
- Add `isPublic` + `sharedWith: [ObjectId]` to Recipe schema
- `POST /api/recipes/:id/share` — share with a friend
- `GET /api/recipes/shared` — view recipes shared with me
- Recipe queries must include owned OR shared-with-me

### 3. Friends / Social
- Add `friends: [ObjectId]` + `friendRequests: [{from, status}]` to User schema
- New `usersController` + `/api/users` routes for friend requests, friend list, user search

### 4. Frontend additions
- `FriendsPage`, `SharedWithMePage`
- `SearchBar`, `CategoryFilter`, `SortControls`, `ShareModal` components
- `usersApi.js` for friends/social API calls
