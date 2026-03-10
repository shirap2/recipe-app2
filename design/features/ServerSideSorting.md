# Feature: Server-Side Sorting for GET /api/recipes

## Overview

Currently, `GET /api/recipes` returns all recipes for a user unsorted, and the frontend (`RecipesPage.jsx`) sorts the array client-side before rendering. This approach breaks down at scale and is inconsistent with how category filtering works (server-side). This feature moves sorting to the database layer.

---

## Files to Modify

| File | Change |
|------|--------|
| `backend/controllers/recipeController.js` | Add `.sort()` to `getAllRecipes` query |
| `frontend/src/api/recipesApi.js` | Pass `sort` and `order` params to the API |
| `frontend/src/pages/RecipesPage.jsx` | Remove client-side sort; pass sort/order to `getAllRecipes` |

---

## Endpoint Specification

### `GET /api/recipes`

**Query parameters:**

| Parameter | Type | Valid values | Default |
|-----------|------|--------------|---------|
| `sort` | string | `title`, `prepTime`, `cookTime`, `createdAt`, `updatedAt` | `createdAt` |
| `order` | string | `asc`, `desc` | `desc` |
| `category` | string | Any valid category enum value | (none — returns all) |

**Examples:**
```
GET /api/recipes                              → sorted by createdAt desc (newest first)
GET /api/recipes?sort=title&order=asc         → alphabetical A→Z
GET /api/recipes?sort=title&order=desc        → alphabetical Z→A
GET /api/recipes?sort=prepTime&order=asc      → shortest prep time first
GET /api/recipes?sort=cookTime&order=desc     → longest cook time first
GET /api/recipes?sort=createdAt&order=asc     → oldest first
GET /api/recipes?category=Dinner&sort=title&order=asc  → category filter + sort combined
```

---

## Allowed Sort Fields

Only these fields may be used as sort keys. Any other value must be silently ignored and fall back to the default (`createdAt`).

```js
const ALLOWED_SORT_FIELDS = ['title', 'prepTime', 'cookTime', 'createdAt', 'updatedAt'];
```

**Why these fields:**
- `title` — alphabetical browsing
- `prepTime` / `cookTime` — sort by effort / time required
- `createdAt` — chronological (most recently added) — the current default
- `updatedAt` — most recently modified (useful for finding recently edited recipes)

**Fields NOT supported for sorting:**
- `ingredients`, `instructions`, `tags` — array fields; MongoDB sort on arrays is not meaningful
- `servings`, `difficulty` — low value; can be added later if needed

---

## Mongoose Implementation

### Controller change (`getAllRecipes`)

```js
const ALLOWED_SORT_FIELDS = ['title', 'prepTime', 'cookTime', 'createdAt', 'updatedAt'];

exports.getAllRecipes = async (req, res) => {
  try {
    const query = { user: req.user.userId };
    if (req.query.category) {
      query.category = req.query.category;
    }

    // Validate sort field — fall back to default if invalid
    const sortField = ALLOWED_SORT_FIELDS.includes(req.query.sort)
      ? req.query.sort
      : 'createdAt';

    // Validate order — fall back to default if invalid
    const sortOrder = req.query.order === 'asc' ? 1 : -1;

    const recipes = await Recipe.find(query).sort({ [sortField]: sortOrder });
    res.json(recipes);
  } catch (error) {
    res.status(500).json({ message: 'Internal Server Error' });
  }
};
```

**Key points:**
- `sort({ [sortField]: sortOrder })` — Mongoose `.sort()` accepts an object where values are `1` (asc) or `-1` (desc)
- Whitelist validation prevents arbitrary field injection
- Invalid `sort` param silently falls back to `createdAt` (no 400 error — graceful degradation)
- Invalid `order` param silently falls back to `desc` (anything other than `'asc'` becomes `-1`)

---

## Default Behavior

| Scenario | Sort field | Sort order | Result |
|----------|-----------|------------|--------|
| No params | `createdAt` | `desc` | Newest recipes first |
| `?sort=title` only | `title` | `desc` | Z→A (unusual, but consistent) |
| `?order=asc` only | `createdAt` | `asc` | Oldest recipes first |
| `?sort=invalid` | `createdAt` | `desc` | Falls back to default |
| `?order=invalid` | `createdAt` | `desc` | Falls back to default |
| `?sort=ingredients` (unsupported) | `createdAt` | `desc` | Falls back to default |

---

## Frontend Changes

### `recipesApi.js`

`getAllRecipes` already accepts `category`. Extend to also accept `sort` and `order`:

```js
export const getAllRecipes = async ({ category = null, sort = 'createdAt', order = 'desc' } = {}) => {
  const params = {};
  if (category) params.category = category;
  params.sort = sort;
  params.order = order;
  const res = await axiosInstance.get('/recipes', { params });
  return res.data;
};
```

### `RecipesPage.jsx`

- Pass `sort` and `order` from URL params to `getAllRecipes` in the `useEffect`
- Remove the client-side `.sort()` call (the `sorted` variable and spread)
- The `useEffect` dependency array gains `sort` and `order` (they were already in URL state)

**Before (client-side sort):**
```js
const data = q ? await searchRecipes(q) : await getAllRecipes(category || null);
// ...
const sorted = [...recipes].sort((a, b) => { ... }); // client-side
```

**After (server-side sort):**
```js
const data = q ? await searchRecipes(q) : await getAllRecipes({ category: category || null, sort, order });
// No client-side sort needed — render recipes directly
```

Note: `searchRecipes` does NOT receive sort/order — search results are returned in relevance/default DB order. This is acceptable for MVP; server-side sort of search results is a future enhancement.

---

## Behavior Matrix

| Has search (`?q=`) | Has category | Has sort/order | Data source | Sort applied |
|--------------------|-------------|----------------|-------------|--------------|
| No | No | No | `getAllRecipes()` | `createdAt desc` (default) |
| No | No | Yes | `getAllRecipes({ sort, order })` | Server-side |
| No | Yes | No | `getAllRecipes({ category })` | `createdAt desc` (default) |
| No | Yes | Yes | `getAllRecipes({ category, sort, order })` | Server-side + filtered |
| Yes | — | — | `searchRecipes(q)` | DB default (unsorted) |

---

## Interaction with Zod Validation

`sort` and `order` are **not** validated by Zod middleware (which validates `req.body`, not `req.query`). Invalid query param values are handled by the whitelist check in the controller. This is intentional — query param validation failures should degrade gracefully, not return 400 errors to the user.

---

## Test Plan Reference

Tests live at: `backend/controllers/__tests__/recipeSorting.test.js`

See test file for full coverage. Key cases:
1. Default sort (no params) → newest recipe first
2. `?sort=title&order=asc` → alphabetical A→Z
3. `?sort=title&order=desc` → alphabetical Z→A
4. `?sort=createdAt&order=asc` → oldest first
5. `?sort=prepTime&order=asc` → shortest prep time first
6. Invalid sort field → falls back to createdAt desc
7. Invalid order value → falls back to desc
8. Sort + category filter combined → sorted subset
9. Another user's recipes not included regardless of sort

---

## Approval Gate

This design file must be reviewed and approved before any code changes are made to `recipeController.js`, `recipesApi.js`, or `RecipesPage.jsx`.
