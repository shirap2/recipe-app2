# Agent Instructions

> This file governs how every coding agent working on this project must behave. It applies equally to all tasks — new components, bug fixes, refactors, and tests. There are no exceptions unless the user explicitly overrides a rule in the task prompt.

---

## 1. Your Inputs and Their Authority

Every coding task provides three files. Read all three fully before writing any code.

| File | Authority | Purpose |
|------|-----------|---------|
| `design/system_design.md` | **Highest** — the law | Architecture, conventions, data models, API contracts, testing policy, security rules |
| `design/components/<Name>.md` | **Task spec** | Exact props, states, behavior, and test cases for the component you are building |
| `design/coding_agent_info/agent_instructions.md` | **Behavioral rules** | How to think, work, and verify before declaring done |

**Conflict resolution:** If the component design file contradicts `system_design.md`, follow `system_design.md` and flag the conflict in a comment at the top of your output. Do not silently pick one.

---

## 2. Pre-Coding Checklist

Do not write a single line of code until you have completed every item on this list.

- [ ] Read `system_design.md` in full
- [ ] Read the component design file in full
- [ ] Read this file in full
- [ ] Identify every file you will create or modify — list them mentally before starting
- [ ] Confirm the component design file exists. If it does not exist, **stop and report** — do not invent the spec
- [ ] Check `system_design.md §2.2 (What to fix)` — if any open bug is directly related to your task, fix it as part of this task and note that you did
- [ ] Check whether the component already partially exists. If it does, read it before modifying it — never overwrite work blindly

---

## 3. Code Conventions

These rules are absolute. They are derived from `system_design.md §12`.

### 3.1 File naming

| What | Rule | Correct | Wrong |
|------|------|---------|-------|
| React components | PascalCase, `.jsx` extension | `RecipeCard.jsx` | `recipeCard.js`, `RecipeCard.js` |
| Pages | PascalCase + `Page` suffix, `.jsx` | `RecipesPage.jsx` | `Recipes.jsx` |
| Hooks | camelCase, `use` prefix, `.js` | `useAuth.js` | `Auth.js`, `useAuth.jsx` |
| API modules | camelCase, `Api` suffix, `.js` | `recipesApi.js` | `recipes.js`, `RecipesApi.js` |
| Backend controllers | camelCase, `Controller` suffix | `recipeController.js` | `recipes.js` |
| Test files (frontend) | Same name + `.test.jsx` | `RecipeCard.test.jsx` | `RecipeCard.spec.js` |
| Test files (backend) | Same name + `.test.js` | `recipeController.test.js` | `recipeController.spec.js` |

**Critical:** Any file containing JSX **must** use the `.jsx` extension. Vite 6 (Rollup) will not parse JSX in `.js` files. This is not negotiable.

### 3.2 Import order

Enforce this order in every file, with a blank line between each group:

```js
// 1. React and React hooks
import { useState, useEffect } from 'react';

// 2. Third-party libraries
import { Link, useNavigate } from 'react-router-dom';

// 3. Context and hooks
import useAuth from '../hooks/useAuth';

// 4. API modules
import { getAllRecipes } from '../api/recipesApi';

// 5. Components
import RecipeCard from '../components/RecipeCard';
```

### 3.3 General code rules

- **No inline styles.** Use Tailwind utility classes only.
- **No `window.confirm()`.** Use the `ConfirmDialog` component (or flag if it doesn't exist yet).
- **No `console.log()` left in committed code.** Remove all debug logs before finishing.
- **No commented-out code blocks.** Delete unused code — version control preserves history.
- **No default exports mixed with named exports** in API modules. API modules use named exports only.
- **No over-engineering.** Only build what the component design file specifies. No extra props, no extra configurability, no abstractions for hypothetical future use.
- **No new npm dependencies** without explicitly stating in your output: the package name, why it's needed, and which existing package (if any) it replaces.

---

## 4. Styling Rules

The design system is defined in `frontend/src/index.css`. It uses Tailwind v4 with a custom `@theme` block.

### 4.1 Color palette — use only these

| Family | Token prefix | Use for |
|--------|-------------|---------|
| Sage greens | `sage-50` through `sage-900` | Backgrounds, text, borders, nav |
| Warm cream | `cream-50` through `cream-400` | Page backgrounds, card backgrounds, subtle borders |
| Terracotta | `terracotta-50` through `terracotta-900` | Primary actions, accents, difficulty badges, step numbers |

**Do not introduce any other color.** No `blue-500`, no `red-400`, no arbitrary hex values. If a design calls for a color outside this palette, flag it — do not silently use a Tailwind default.

### 4.2 Existing component classes — use them, don't duplicate them

These classes are defined in `index.css` and must be used as-is:

| Class | Use for |
|-------|---------|
| `.btn-primary` | Primary action buttons (terracotta fill) |
| `.btn-secondary` | Secondary actions (cream fill, bordered) |
| `.btn-danger` | Destructive actions (light terracotta) |
| `.btn-ghost` | Tertiary / cancel actions (transparent, bordered) |
| `.input` | All text inputs, selects, textareas |
| `.card` | White bordered rounded panels |
| `.field-label` | Labels above form inputs |
| `.page` | Top-level page wrapper with max-width and padding |

**If a visual pattern appears more than once** in your new component, extract it into a named class in `index.css` under `@layer components`. Do not copy-paste the same long Tailwind string in multiple places in JSX.

### 4.3 Typography

- Font: `Montserrat` (set globally on `body` via `font-sans`)
- Do not set `font-family` anywhere else
- Headings use `font-bold tracking-tight` — already applied globally to `h1`, `h2`, `h3`

### 4.4 Border radius

| Token | Value | Use for |
|-------|-------|---------|
| `rounded` | 4px | Buttons, inputs, tags |
| `rounded-lg` | 8px | Cards, panels |

Do not use `rounded-full`, `rounded-xl`, or other radius values unless the component design file explicitly calls for them.

---

## 5. Testing Rules

Every coding task produces tests. Tests are not optional and are not a separate task. Derived from `system_design.md §9`.

### 5.1 Test file locations

```
frontend/src/components/__tests__/<Name>.test.jsx
frontend/src/pages/__tests__/<Name>.test.jsx
frontend/src/api/__tests__/<name>.test.js
backend/controllers/__tests__/<name>.test.js
backend/middleware/__tests__/<name>.test.js
```

### 5.2 Frontend component tests — mandatory cases

Every component test file must include, at minimum:

1. **Smoke test** — renders without crashing
2. **Each named state** — loading, empty, error, populated (whichever apply per the design file)
3. **Key interactions** — button clicks, form submissions, navigation events
4. **Accessibility** — interactive elements (buttons, inputs, links) have accessible labels or roles

Use this skeleton:

```jsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import ComponentName from '../ComponentName';

// Mock dependencies
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { id: '1', username: 'alice' } }) }));
vi.mock('../../api/recipesApi');

const renderWithRouter = (ui) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('ComponentName', () => {
  it('renders without crashing', () => {
    renderWithRouter(<ComponentName />);
  });

  it('shows loading state', () => { ... });
  it('shows empty state', () => { ... });
  it('shows error state', () => { ... });
  it('renders populated data', () => { ... });
  it('calls onSubmit when form is submitted', async () => { ... });
});
```

### 5.3 Frontend API module tests — mandatory cases

```js
import { vi } from 'vitest';
import axiosInstance from '../axios';

vi.mock('../axios');

describe('getAllRecipes', () => {
  it('calls GET /recipes', async () => { ... });
  it('returns response data', async () => { ... });
});
```

### 5.4 Backend controller tests — mandatory cases

1. **Success path** — correct status code + response shape
2. **Not found** — 404 when resource doesn't exist or belongs to another user
3. **Validation failure** — 400 when required fields are missing or invalid
4. **Auth scoping** — resource is scoped to `req.user.userId`, not accessible by other users

Use `mongodb-memory-server` for all database tests. Never connect to a real or shared database in tests.

```js
// Skeleton
import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../server';

describe('POST /api/recipes', () => {
  it('creates a recipe and returns 201', async () => { ... });
  it('returns 400 when title is missing', async () => { ... });
  it('returns 401 without a token', async () => { ... });
});
```

### 5.5 Mocking conventions

| What to mock | How |
|-------------|-----|
| Axios instances | `vi.mock('../api/axios')` |
| API modules | `vi.mock('../api/recipesApi')` |
| `useAuth` hook | `vi.mock('../hooks/useAuth', () => ({ default: () => ({ user: {...} }) }))` |
| React Router | Wrap render in `<MemoryRouter>` |
| `window.confirm` | `vi.spyOn(window, 'confirm').mockReturnValue(true)` (only if `window.confirm` is still present — it should be replaced by `ConfirmDialog`) |

### 5.6 What does NOT need tests

- `main.jsx` — React DOM entry point
- `App.jsx` — route wiring (covered by E2E)
- `index.css` — CSS
- Config files (`vite.config.js`, `jest.config.js`)

---

## 6. API and Auth Patterns

### 6.1 Which axios instance to use

| Call type | Instance | Import |
|-----------|----------|--------|
| Login, register, refresh | `publicAxios` | `import { publicAxios } from '../api/axios'` |
| All protected API calls | `axiosInstance` (default) | `import axiosInstance from '../api/axios'` |

**Never import axios directly** (`import axios from 'axios'`) in page or component files. Always go through `api/axios.js`.

### 6.2 Reading auth state in components

```js
// Correct
import useAuth from '../hooks/useAuth';
const { user, login, logout } = useAuth();

// Wrong — never do this
import AuthContext from '../context/AuthContext';
import { useContext } from 'react';
const { user } = useContext(AuthContext);
```

### 6.3 Tokens — where they live and where they don't

| Location | Allowed |
|----------|---------|
| `useRef` inside `AuthContext` | Yes — this is the only place |
| `useState` | No — causes unnecessary re-renders and risks exposure |
| `localStorage` / `sessionStorage` | **Never** |
| A component's own state | **Never** |
| A URL param or query string | **Never** |

### 6.4 Backend: protecting a new route

Apply auth middleware at the router level, not per-route, for resource routes:

```js
// server.js — correct
app.use('/api/newresource', authenticate, newResourceRouter);

// routes/newresource.js — no authenticate needed here
router.get('/', controller.getAll);
```

Only apply auth per-route for mixed-access routes (e.g. a route that has both public and protected endpoints).

### 6.5 Backend: always scope queries to the authenticated user

```js
// Correct
const items = await Model.find({ user: req.user.userId });

// Wrong — never return all documents without user scoping
const items = await Model.find({});
```

---

## 7. What You Must Not Do

These are hard stops. If completing a task would require any of the following, stop and flag it rather than proceeding.

| Prohibited | Why |
|-----------|-----|
| Use `window.confirm()` | Breaks design consistency — use `ConfirmDialog` |
| Store tokens in localStorage | Security violation |
| Use colors outside sage/cream/terracotta | Breaks design system |
| Import axios directly in components | Bypasses auth interceptor architecture |
| Use `.js` extension for JSX files | Vite 6 will not parse it |
| Add features not specified in the component design file | Scope creep — ask first |
| Modify a backend route's auth scoping without flagging it | Security regression risk |
| Leave `console.log` in code | Debug pollution |
| Create a new file when editing an existing one is correct | File bloat |
| Skip writing tests | Non-negotiable |
| Use `window.alert()` | Same reason as `window.confirm()` |
| Hard-code any URL or port | Use `BASE_URL` from `api/axios.js` |
| Expose stack traces in API error responses | Security violation |

---

## 8. Output Checklist

Before declaring your task complete, verify every item:

- [ ] All files listed in the component design file are created or modified
- [ ] All test files are written and cover the mandatory cases from §5
- [ ] No new colors used outside the design palette
- [ ] No inline styles
- [ ] No `window.confirm()` or `window.alert()`
- [ ] No `console.log()` remaining
- [ ] No commented-out code remaining
- [ ] Imports follow the order defined in §3.2
- [ ] All JSX files use `.jsx` extension
- [ ] If a new npm package was added, it is explicitly noted with justification
- [ ] If a bug from `system_design.md §2.2` was addressed, it is noted
- [ ] If anything in the design files was ambiguous or contradictory, it is flagged in your output — not silently resolved

---

## 9. How to Handle Ambiguity

If the component design file is silent on something you need to decide:

1. **Check `system_design.md` first** — the answer is often there
2. **Default to the most minimal interpretation** — do less, not more
3. **Use existing patterns in the codebase** — match how similar things are already done
4. **If still unclear, flag it** — state your assumption explicitly in your output so it can be confirmed or corrected

Never silently make a significant design decision. An assumption stated is better than an assumption hidden.
