# Recipe App — System Design

## Overview

A full-stack recipe management app with user authentication, recipe CRUD, social sharing, search, and ingredient-based discovery.

**Stack:** React (frontend) · Node/Express (backend) · MongoDB (database)

---

## Current State

### Backend (complete)
- JWT auth with access tokens (5m) + refresh tokens (1d via httpOnly cookie)
- Recipe CRUD scoped to authenticated user
- Basic text search on title/tags

### Frontend (in progress)
- Axios instance with `withCredentials: true`
- `authApi.js` — login + refresh calls

---

## Data Models

### User
```
_id, username, email, password (hashed), refreshToken, role, timestamps
```
**To add:** `friends: [ObjectId]`, `friendRequests: [{ from, status }]`

### Recipe
```
_id, user (ref), title, ingredients[{name, amount, unit}],
instructions[], prepTime, cookTime, servings, tags[], notes,
difficulty, source, sourceUrl, sourceImage, createdAt, updatedAt
```
**To add:** `category`, `isPublic`, `sharedWith: [ObjectId]`, `likes: [ObjectId]`

---

## Planned Features & API Design

### 1. Recipe Search
- **By title/tags:** `GET /api/recipes/search?query=pasta` ✅ (exists)
- **By ingredients:** `GET /api/recipes/search?ingredients=tomato,garlic`
- **By category:** `GET /api/recipes?category=Breakfast`
- **Combined filters:** `GET /api/recipes?category=Dinner&difficulty=Easy&sort=prepTime`

Backend changes needed:
- Add `category` field to Recipe schema (enum: Breakfast, Lunch, Dinner, Snack, Dessert, Drink, Other)
- Extend `searchRecipes` to support ingredient and category filters
- Add sort param support (`createdAt`, `prepTime`, `cookTime`, `title`)

### 2. Recipe Sharing
- `POST /api/recipes/:id/share` — share with a friend by userId
- `GET /api/recipes/shared` — get recipes shared with the current user
- `DELETE /api/recipes/:id/share/:friendId` — revoke share

Backend changes needed:
- Add `isPublic` and `sharedWith: [ObjectId]` to Recipe schema
- Recipes query must include `OR: owned by user OR shared with user`

### 3. Friends / Social
- `POST /api/users/friends/request` — send friend request (body: `{ username }`)
- `PATCH /api/users/friends/request/:userId` — accept/decline (`{ action: 'accept'|'decline' }`)
- `GET /api/users/friends` — list friends
- `DELETE /api/users/friends/:userId` — remove friend
- `GET /api/users/search?username=...` — find users to add

Backend changes needed:
- Add `friends` and `friendRequests` arrays to User schema
- New `users` route + `usersController`

### 4. Category / Sorting
- Extend Recipe schema with `category` field
- `GET /api/recipes?category=Dinner&sort=cookTime&order=asc`
- Frontend: category filter tabs + sort dropdown

---

## Frontend Architecture

```
frontend/
├── src/
│   ├── api/
│   │   ├── axios.js          ✅ (exists)
│   │   ├── authApi.js        ✅ (exists)
│   │   ├── recipesApi.js     (to create)
│   │   └── usersApi.js       (to create)
│   ├── context/
│   │   └── AuthContext.jsx   (to create — store user, accessToken, refresh logic)
│   ├── hooks/
│   │   └── useAuth.js        (to create)
│   ├── pages/
│   │   ├── LoginPage.jsx
│   │   ├── RegisterPage.jsx
│   │   ├── RecipesPage.jsx   (list + search + filter)
│   │   ├── RecipeDetailPage.jsx
│   │   ├── CreateRecipePage.jsx
│   │   ├── EditRecipePage.jsx
│   │   ├── FriendsPage.jsx
│   │   └── SharedWithMePage.jsx
│   ├── components/
│   │   ├── RecipeCard.jsx
│   │   ├── RecipeList.jsx
│   │   ├── SearchBar.jsx
│   │   ├── CategoryFilter.jsx
│   │   ├── SortControls.jsx
│   │   ├── IngredientSearch.jsx
│   │   ├── ShareModal.jsx
│   │   └── NavBar.jsx
│   ├── App.js
│   └── index.js
```

### Auth Flow
1. Login → receive `accessToken` (memory) + `refreshToken` (httpOnly cookie)
2. Axios interceptor: on 401 response, auto-call `/api/auth/refresh`, retry original request
3. `AuthContext` holds `user` object and `accessToken` in React state (not localStorage)
4. On app load: call `/api/auth/refresh` to restore session from cookie

---

## Immediate Next Steps (Priority Order)

### Step 1 — Frontend Foundation
- [ ] Set up React Router (`react-router-dom`)
- [ ] Build `AuthContext` + `useAuth` hook with token refresh interceptor
- [ ] Login page + Register page
- [ ] Protected route wrapper

### Step 2 — Core Recipe UI
- [ ] `recipesApi.js` — CRUD calls
- [ ] Recipe list page with cards
- [ ] Create/Edit recipe forms
- [ ] Recipe detail page

### Step 3 — Search & Filter
- [ ] Search bar (title/tags)
- [ ] Category filter tabs
- [ ] Ingredient search
- [ ] Sort controls

### Step 4 — Backend Additions
- [ ] Add `category` to Recipe schema
- [ ] Extend search endpoint for ingredient + category + sort
- [ ] Add `isPublic` + `sharedWith` to Recipe schema

### Step 5 — Social Features
- [ ] Add `friends` + `friendRequests` to User schema
- [ ] Friends route + controller
- [ ] Recipe sharing endpoints
- [ ] Friends page UI + Share modal

---

## Security Checklist

- [x] Passwords hashed with bcrypt (cost 10)
- [x] JWT access tokens short-lived (5m)
- [x] Refresh tokens stored httpOnly cookie (not localStorage)
- [x] Refresh token rotation on each use
- [x] Regex input escaped in search (ReDoS fix)
- [ ] Rate limiting on auth routes (`express-rate-limit`)
- [ ] Input validation middleware (`express-validator` or `zod`)
- [ ] Security headers (`helmet`)
- [ ] MongoDB injection protection (`express-mongo-sanitize`)
- [ ] CORS locked to specific frontend origin (done in dev, verify in prod)
