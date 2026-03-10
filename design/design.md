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
│   ├── controllers/  authController.js, recipeController.js, usersController.js
│   ├── middleware/   JWT auth guard (auth.js)
│   ├── models/       Mongoose schemas (User.js, Recipe.js)
│   ├── routes/       Express routers (auth.js, recipes.js, users.js)
│   └── server.js     Entry point — CORS, middleware, route mounting
└── frontend/         React SPA (Vite 6)
    └── src/
        ├── api/      axios.js, authApi.js, recipesApi.js, usersApi.js
        ├── context/  AuthContext.jsx, ToastContext.jsx
        ├── hooks/    useAuth.js, useToast.js
        ├── pages/    Full-page route components
        ├── components/ Shared UI components
        └── test/     setup.js (jest-dom import)
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

`/auth/refresh` returns `{ accessToken, user: {id, username, email} }` — same shape as login.

### Users Routes — `/api/users/*`

All require Bearer token (enforced at the router level in `server.js`).

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/users/me` | `getMe` — returns `{id, username, email}` |

### Recipe Routes — `/api/recipes/*`

All routes require a valid Bearer access token (enforced at the router level).

| Method | Path | Handler |
|--------|------|---------|
| GET | `/api/recipes` | `getAllRecipes` — accepts `?category=` |
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
| `category` | Enum: Breakfast/Lunch/Dinner/Snack/Dessert/Drink/Other | Default: Other |
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
- **Refresh response shape:** `{ accessToken, user: {id, username, email} }` — same as login, so `AuthContext` can restore full user state without a second API call
- **Auth middleware (`middleware/auth.js`):** Extracts `Authorization: Bearer <token>`, verifies signature, sets `req.user = { userId }`

---

## Frontend

### Routing (`App.jsx`)

Provider nesting: `BrowserRouter > AuthProvider > ToastProvider > Routes`

```
/login                → LoginPage       (public)
/register             → RegisterPage    (public)
/recipes              → RecipesPage     (protected) — ?q= ?sort= ?order= ?category=
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
- **`axiosInstance`** (default export) — used by all protected calls; interceptors attached by `AuthContext`

`recipesApi.js` exposes: `getAllRecipes(category?)`, `getRecipeById`, `createRecipe`, `updateRecipe`, `deleteRecipe`, `searchRecipes`.

`usersApi.js` exposes: `getMe`.

### Key Components

**`RecipeForm`** — shared create/edit form: dynamic ingredients + instructions, category select, `toFormState`/`toPayload` converters. Used by `CreateRecipePage` and `EditRecipePage`.

**`NavBar`** — sticky top nav. Displays `user.username` (populated from refresh response). Links: My Recipes, + New Recipe. Logout button.

**`RecipeCard`** — summary card in recipe list. Shows title, difficulty badge, total time, up to 4 tags.

**`SearchBar`** — controlled search input; calls `onSearch(query)` / `onClear()`. Read-once `initialValue` from URL.

**`CategoryFilter`** — pill group (All + 7 categories); calls `onChange(category | null)`. Active pill via `.filter-pill-active`.

**`SortControls`** — sort field + order selects; calls `onChange(sort, order)`.

**`ConfirmDialog`** — inline confirm: trigger button → message + Confirm/Cancel. Used in `RecipeDetailPage` for delete.

**`Toast` / `ToastContext` / `useToast`** — non-blocking notifications. `showToast(message, 'success'|'error')`. Auto-dismisses after 4s.

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

### 1. Search & Filter (partially done)
- **Done:** Category filter (`GET /api/recipes?category=`, `CategoryFilter` component)
- **Done:** Sort controls (client-side, `SortControls` component + URL params)
- **Still needed:** Ingredient-based search: `GET /api/recipes/search?ingredients=tomato,garlic`
- **Still needed:** Server-side sort: `GET /api/recipes?sort=&order=`

### 2. Recipe Sharing
- Add `isPublic` + `sharedWith: [ObjectId]` to Recipe schema
- `POST /api/recipes/:id/share` — share with a friend
- `GET /api/recipes/shared` — view recipes shared with me
- `ShareModal` component (design file exists at `design/components/ShareModal.md`)
- `SharedWithMePage`

### 3. Friends / Social
- Add `friends: [ObjectId]` + `friendRequests: [{from, status}]` to User schema
- Extend `/api/users` routes: friend requests, friend list, user search
- `FriendsPage`, `FriendCard` component (design file exists at `design/components/FriendCard.md`)

### 4. Image Uploads
- Add `imageUrl: String` to Recipe schema
- `POST /api/recipes/:id/image` — upload cover image
- `ImageUpload` component
