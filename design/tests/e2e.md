# E2E Test Design — Recipe App

> **Authoritative Playwright test plan for the Recipe App full-stack deployment.**
> Frontend: React (Vite, port 3000). Backend: Node/Express (port 5000). Database: MongoDB.
> All test suites run on Chromium desktop and Pixel 5 mobile unless otherwise noted.

---

## Table of Contents

1. [Setup & Configuration](#1-setup--configuration)
   - [playwright.config.ts](#11-playwrightconfigts)
   - [Global Setup & Teardown](#12-global-setup--teardown)
   - [Test Helpers](#13-test-helpers)
   - [Page Object Models](#14-page-object-models-poms)
2. [Suite: Auth](#2-suite-auth)
3. [Suite: Recipe CRUD](#3-suite-recipe-crud)
4. [Suite: Search, Filter & Sort](#4-suite-search-filter--sort)
5. [Suite: Navigation & Protected Routes](#5-suite-navigation--protected-routes)
6. [Suite: Session Resilience](#6-suite-session-resilience)
7. [Mobile-Specific Considerations](#7-mobile-specific-considerations)

---

## 1. Setup & Configuration

### 1.1 `playwright.config.ts`

**Location:** `e2e/playwright.config.ts`

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Directory containing all .spec.ts test files
  testDir: './e2e',

  // Only run files matching this pattern
  testMatch: '**/*.spec.ts',

  // Do NOT run tests in parallel — all suites share a single test database.
  // Sequential execution prevents state collisions between tests.
  fullyParallel: false,

  // Retry once on CI to tolerate transient timing issues; no retries locally.
  retries: process.env.CI ? 1 : 0,

  // Fail the run after the first test failure in CI to get fast feedback.
  // Locally allow all tests to complete so the developer sees the full picture.
  maxFailures: process.env.CI ? 1 : undefined,

  use: {
    // All page.goto('/login') calls resolve against this base URL.
    baseURL: 'http://localhost:3000',

    // Capture a screenshot on failure for every project.
    screenshot: 'only-on-failure',

    // Capture a Playwright trace on retry so failures in CI are debuggable.
    trace: 'on-first-retry',

    // Send cookies on cross-origin requests so the httpOnly refreshToken
    // cookie reaches the backend on port 5000.
    extraHTTPHeaders: {},
  },

  // Global setup starts servers; global teardown stops them.
  globalSetup: './e2e/global-setup.ts',
  globalTeardown: './e2e/global-teardown.ts',

  projects: [
    // --- Desktop ---
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },

    // --- Mobile ---
    // Pixel 5: 393 × 851, deviceScaleFactor 2.75, touch enabled
    {
      name: 'mobile-pixel5',
      use: { ...devices['Pixel 5'] },
    },

    // iPhone 12: 390 × 844, deviceScaleFactor 3, touch enabled
    {
      name: 'mobile-iphone12',
      use: { ...devices['iPhone 12'] },
    },
  ],

  // The Vite dev server and Express server are started in globalSetup,
  // not by Playwright's webServer option, so that both servers can share
  // the same in-process mongodb-memory-server instance.
});
```

**Key decisions:**

| Decision | Rationale |
|----------|-----------|
| `fullyParallel: false` | Tests share a single in-memory MongoDB. Parallel execution causes race conditions on `beforeEach` database clears. |
| `retries: 1` in CI | The Vite dev server and mongodb-memory-server can introduce ~200ms startup variance. One retry absorbs this without masking real failures. |
| Three projects | The app targets web and mobile. Chromium covers desktop browsers; Pixel 5 and iPhone 12 cover the two most common Android and iOS screen sizes. |
| `globalSetup` over `webServer` | The `webServer` option starts a single process. We need coordinated control over three processes (MongoDB, Express, Vite) that must start in order and share environment variables. |

---

### 1.2 Global Setup & Teardown

#### `e2e/global-setup.ts`

```typescript
import { MongoMemoryServer } from 'mongodb-memory-server';
import { spawn, ChildProcess } from 'child_process';
import path from 'path';

declare global {
  // Expose handles on the Node.js global so globalTeardown can shut them down.
  var __MONGOD__: MongoMemoryServer;
  var __BACKEND__: ChildProcess;
  var __FRONTEND__: ChildProcess;
}

export default async function globalSetup() {
  // ── Step 1: Start MongoDB in memory ──────────────────────────────────────
  // mongodb-memory-server downloads and caches a real mongod binary.
  // The URI is injected into the backend process via environment variable.
  const mongod = await MongoMemoryServer.create();
  const mongoUri = mongod.getUri();
  global.__MONGOD__ = mongod;

  // ── Step 2: Start the Express backend ────────────────────────────────────
  // server.js exports the app and only calls app.listen() when
  // require.main === module, so spawning node server.js is safe.
  const backendEnv = {
    ...process.env,
    NODE_ENV: 'test',
    PORT: '5000',
    MONGO_URI: mongoUri,
    // Use short-lived access tokens so session-resilience tests run quickly.
    // Override this in individual tests via the ACCESS_TOKEN_EXPIRES_IN env var
    // passed at spawn time, or use a dedicated fixture for token-expiry tests.
    ACCESS_TOKEN_SECRET: 'test-access-secret-64-bytes-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    REFRESH_TOKEN_SECRET: 'test-refresh-secret-64-bytes-long-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    ACCESS_TOKEN_EXPIRES_IN: '5m',   // default; override to '2s' for expiry tests
  };

  const backendProcess = spawn('node', ['server.js'], {
    cwd: path.resolve(__dirname, '../../backend'),
    env: backendEnv,
    stdio: 'pipe',
  });
  global.__BACKEND__ = backendProcess;

  // Wait for the backend to signal it is listening.
  await waitForOutput(backendProcess, 'Server running on http://localhost:5000');

  // ── Step 3: Start the Vite frontend dev server ────────────────────────────
  const frontendProcess = spawn('npm', ['run', 'dev'], {
    cwd: path.resolve(__dirname, '../../frontend'),
    env: { ...process.env, PORT: '3000' },
    stdio: 'pipe',
    shell: true,   // required on Windows for npm to resolve correctly
  });
  global.__FRONTEND__ = frontendProcess;

  // Wait for Vite's "Local: http://localhost:3000" ready message.
  await waitForOutput(frontendProcess, 'localhost:3000');
}

// Poll a child process's stdout/stderr until a string appears, or time out.
function waitForOutput(proc: ChildProcess, text: string, timeoutMs = 30_000): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for: "${text}"`)), timeoutMs);
    const check = (chunk: Buffer) => {
      if (chunk.toString().includes(text)) {
        clearTimeout(timer);
        resolve();
      }
    };
    proc.stdout?.on('data', check);
    proc.stderr?.on('data', check);
  });
}
```

#### `e2e/global-teardown.ts`

```typescript
export default async function globalTeardown() {
  // Kill frontend and backend processes first (SIGTERM, then SIGKILL after 5s).
  global.__FRONTEND__?.kill('SIGTERM');
  global.__BACKEND__?.kill('SIGTERM');

  // Stop the in-memory MongoDB and clean up its data directory.
  await global.__MONGOD__?.stop();
}
```

**Environment variable reference for test configuration:**

| Variable | Default | Override for |
|----------|---------|-------------|
| `MONGO_URI` | auto (mongodb-memory-server) | Use `TEST_MONGO_URI` env to point at a dedicated test Atlas cluster instead |
| `ACCESS_TOKEN_EXPIRES_IN` | `5m` | Set to `2s` when spawning the backend in session-resilience tests |
| `NODE_ENV` | `test` | Never change; guards production-only code paths |
| `PORT` | `5000` | Do not change; hardcoded in frontend Axios base URL |

> **Using a remote test database instead of mongodb-memory-server:**
> Set `TEST_MONGO_URI` in your environment before running `playwright test`. In `global-setup.ts`, replace the `MongoMemoryServer.create()` block with:
> ```typescript
> const mongoUri = process.env.TEST_MONGO_URI ?? (await MongoMemoryServer.create()).getUri();
> ```

---

### 1.3 Test Helpers

All helpers live in `e2e/helpers/`.

#### `e2e/helpers/auth.helper.ts`

```typescript
import { Page } from '@playwright/test';

export interface UserCredentials {
  username: string;
  email?: string;
  password: string;
}

/**
 * Fills the register form and submits it.
 * Waits for navigation to /recipes before returning.
 * Throws if the form returns an error.
 */
export async function registerUser(page: Page, creds: { username: string; email: string; password: string }) {
  await page.goto('/register');
  await page.getByLabel('Username').fill(creds.username);
  await page.getByLabel('Email').fill(creds.email);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL('/recipes');
}

/**
 * Fills the login form and submits it.
 * Accepts either a username or an email in the `username` field
 * (the backend supports both via BUG-002 fix).
 * Waits for navigation to /recipes before returning.
 */
export async function loginUser(page: Page, creds: { username: string; password: string }) {
  await page.goto('/login');
  await page.getByLabel('Username').fill(creds.username);
  await page.getByLabel('Password').fill(creds.password);
  await page.getByRole('button', { name: 'Sign In' }).click();
  await page.waitForURL('/recipes');
}

/**
 * Clicks the Logout button in the NavBar and waits for /login.
 */
export async function logoutUser(page: Page) {
  await page.getByRole('button', { name: 'Logout' }).click();
  await page.waitForURL('/login');
}
```

#### `e2e/helpers/recipe.helper.ts`

```typescript
import { Page, request as playwrightRequest } from '@playwright/test';

export interface RecipeData {
  title: string;
  category?: string;
  difficulty?: 'Easy' | 'Medium' | 'Hard';
  prepTime?: number;
  cookTime?: number;
  servings?: number;
  tags?: string[];
  notes?: string;
  ingredients: Array<{ name: string; amount: number; unit: string }>;
  instructions?: string[];
}

/**
 * Creates a recipe by calling the API directly (no browser UI).
 * Use this in beforeEach to seed data efficiently without relying on UI interactions.
 *
 * @param authToken - A valid Bearer access token obtained from a login API call.
 * @param recipeData - The recipe payload.
 * @returns The created recipe object (including _id).
 */
export async function createRecipeViaAPI(authToken: string, recipeData: RecipeData) {
  const ctx = await playwrightRequest.newContext();
  const response = await ctx.post('http://localhost:5000/api/recipes', {
    headers: { Authorization: `Bearer ${authToken}` },
    data: recipeData,
  });
  if (!response.ok()) {
    throw new Error(`createRecipeViaAPI failed: ${response.status()} ${await response.text()}`);
  }
  return response.json();
}

/**
 * Obtains a raw access token for a user by POSTing to the login endpoint directly.
 * Use this when you need a token for createRecipeViaAPI seeding.
 */
export async function getAuthToken(username: string, password: string): Promise<string> {
  const ctx = await playwrightRequest.newContext();
  const response = await ctx.post('http://localhost:5000/api/auth/login', {
    data: { username, password },
  });
  if (!response.ok()) {
    throw new Error(`getAuthToken failed: ${response.status()}`);
  }
  const body = await response.json();
  return body.accessToken;
}

/**
 * Creates a recipe by driving the browser UI through RecipeForm.
 * Use this only when the test specifically validates form behaviour.
 *
 * Precondition: page is already on /recipes/new.
 */
export async function createRecipeViaUI(page: Page, data: RecipeData) {
  // Title
  await page.getByLabel('Title *').fill(data.title);

  // Category
  if (data.category) {
    await page.getByLabel('Category').selectOption(data.category);
  }

  // Difficulty
  if (data.difficulty) {
    await page.getByLabel('Difficulty').selectOption(data.difficulty);
  }

  // Times
  if (data.prepTime !== undefined) {
    await page.getByLabel('Prep Time (min)').fill(String(data.prepTime));
  }
  if (data.cookTime !== undefined) {
    await page.getByLabel('Cook Time (min)').fill(String(data.cookTime));
  }
  if (data.servings !== undefined) {
    await page.getByLabel('Servings').fill(String(data.servings));
  }

  // Ingredients — the form starts with one blank row
  for (let i = 0; i < data.ingredients.length; i++) {
    if (i > 0) {
      await page.getByRole('button', { name: '+ Add Ingredient' }).click();
    }
    const nameInputs   = page.locator('input[placeholder="Name"]');
    const amountInputs = page.locator('input[placeholder="Amount"]');
    const unitInputs   = page.locator('input[placeholder="Unit (g, cup\u2026)"]');
    await nameInputs.nth(i).fill(data.ingredients[i].name);
    await amountInputs.nth(i).fill(String(data.ingredients[i].amount));
    await unitInputs.nth(i).fill(data.ingredients[i].unit);
  }

  // Instructions
  if (data.instructions?.length) {
    for (let i = 0; i < data.instructions.length; i++) {
      if (i > 0) {
        await page.getByRole('button', { name: '+ Add Step' }).click();
      }
      await page.locator('textarea').nth(i).fill(data.instructions[i]);
    }
  }

  // Tags
  if (data.tags?.length) {
    await page.getByLabel('Tags').fill(data.tags.join(', '));
  }

  // Notes
  if (data.notes) {
    await page.getByLabel('Notes').fill(data.notes);
  }

  // Submit
  await page.getByRole('button', { name: 'Create Recipe' }).click();
}
```

#### `e2e/helpers/db.helper.ts`

```typescript
import { MongoClient } from 'mongodb';

/**
 * Drops all collections in the test database.
 * Call in beforeEach to guarantee a clean state for every test.
 *
 * The MONGO_URI used here must match the one passed to the backend process
 * in global-setup.ts. In practice both are read from process.env.TEST_MONGO_URI
 * or from the global __MONGOD__ URI written to process.env by globalSetup.
 */
export async function clearDatabase() {
  const uri = process.env.MONGO_URI_TEST;
  if (!uri) throw new Error('MONGO_URI_TEST is not set. Did globalSetup run?');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  const collections = await db.listCollections().toArray();
  await Promise.all(collections.map(c => db.collection(c.name).deleteMany({})));
  await client.close();
}
```

> **Note on `MONGO_URI_TEST`:** In `global-setup.ts`, after creating the `MongoMemoryServer`, write its URI to `process.env.MONGO_URI_TEST` so that `db.helper.ts` can connect to the same instance from within Playwright worker processes.

---

### 1.4 Page Object Models (POMs)

All POMs live in `e2e/page-objects/`. Each POM encapsulates selectors and common interactions. Tests import and use POMs rather than writing raw locators inline.

#### `e2e/page-objects/LoginPage.po.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class LoginPagePO {
  readonly usernameInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    // The label text is "Username" — getByLabel is preferred over getByPlaceholder
    // because it is resilient to placeholder text changes.
    this.usernameInput  = page.getByLabel('Username');
    this.passwordInput  = page.getByLabel('Password');
    this.submitButton   = page.getByRole('button', { name: 'Sign In' });
    // Error paragraph: rendered conditionally when error state is non-empty.
    // Text varies ("Invalid credentials. Please try again." or a server message),
    // so we select by the wrapping element's stable CSS class structure.
    this.errorMessage   = page.locator('p.text-terracotta-600');
  }

  async goto() {
    await this.page.goto('/login');
  }

  async login(username: string, password: string) {
    await this.usernameInput.fill(username);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

#### `e2e/page-objects/RegisterPage.po.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class RegisterPagePO {
  readonly usernameInput: Locator;
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.usernameInput = page.getByLabel('Username');
    this.emailInput    = page.getByLabel('Email');
    this.passwordInput = page.getByLabel('Password');
    this.submitButton  = page.getByRole('button', { name: 'Create Account' });
    this.errorMessage  = page.locator('p.text-terracotta-600');
  }

  async goto() {
    await this.page.goto('/register');
  }

  async register(username: string, email: string, password: string) {
    await this.usernameInput.fill(username);
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
    await this.submitButton.click();
  }
}
```

#### `e2e/page-objects/RecipesPage.po.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class RecipesPagePO {
  // SearchBar: the single text input inside the SearchBar component.
  // No explicit label; select by placeholder text which is stable.
  readonly searchInput: Locator;

  // CategoryFilter: all filter-pill buttons (All, Breakfast, Lunch, …)
  readonly categoryPills: Locator;

  // SortControls: a <select> element driving sort field + order.
  // The component renders a single <select> for sort field.
  // Identify by its visible option text patterns ("Title A→Z", etc.)
  readonly sortSelect: Locator;

  // Recipe grid: each RecipeCard is a <a> element linking to /recipes/:id
  readonly recipeCards: Locator;

  // "New Recipe" link in the page header
  readonly newRecipeButton: Locator;

  constructor(private page: Page) {
    this.searchInput     = page.getByPlaceholder(/search/i);
    this.categoryPills   = page.locator('.filter-pill, .filter-pill-active');
    this.sortSelect      = page.locator('select').first(); // SortControls renders the first select
    this.recipeCards     = page.locator('a[href^="/recipes/"]').filter({ hasNot: page.locator('nav') });
    this.newRecipeButton = page.getByRole('link', { name: '+ New Recipe' }).first();
  }

  async goto() {
    await this.page.goto('/recipes');
  }

  async search(query: string) {
    await this.searchInput.fill(query);
    await this.searchInput.press('Enter');
  }

  async selectCategory(name: string) {
    await this.categoryPills.filter({ hasText: name }).click();
  }

  /** Returns the text content of all visible recipe card titles. */
  async getCardTitles(): Promise<string[]> {
    return this.recipeCards.locator('h3').allTextContents();
  }
}
```

#### `e2e/page-objects/RecipeDetailPage.po.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class RecipeDetailPagePO {
  readonly title: Locator;
  readonly deleteButton: Locator;
  readonly editButton: Locator;
  // ConfirmDialog renders two buttons after the delete trigger is clicked
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;
  readonly backLink: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.title         = page.locator('h1');
    // The delete trigger is a button labelled "Delete" rendered by ConfirmDialog.
    this.deleteButton  = page.getByRole('button', { name: 'Delete' });
    // "Edit" is rendered as a link styled as a button.
    this.editButton    = page.getByRole('link', { name: 'Edit' });
    // After clicking deleteButton, ConfirmDialog replaces it with Confirm + Cancel.
    this.confirmButton = page.getByRole('button', { name: 'Confirm' });
    this.cancelButton  = page.getByRole('button', { name: 'Cancel' });
    this.backLink      = page.getByRole('link', { name: '← My Recipes' });
    this.errorMessage  = page.locator('p.text-terracotta-600');
  }
}
```

#### `e2e/page-objects/RecipeForm.po.ts`

```typescript
import { Page, Locator } from '@playwright/test';

export class RecipeFormPO {
  readonly titleInput: Locator;
  readonly categorySelect: Locator;
  readonly difficultySelect: Locator;
  readonly prepTimeInput: Locator;
  readonly cookTimeInput: Locator;
  readonly servingsInput: Locator;
  readonly tagsInput: Locator;
  readonly notesTextarea: Locator;
  readonly addIngredientButton: Locator;
  readonly addStepButton: Locator;
  readonly submitButton: Locator;
  readonly errorMessage: Locator;

  constructor(private page: Page) {
    this.titleInput          = page.getByLabel('Title *');
    this.categorySelect      = page.getByLabel('Category');
    this.difficultySelect    = page.getByLabel('Difficulty');
    this.prepTimeInput       = page.getByLabel('Prep Time (min)');
    this.cookTimeInput       = page.getByLabel('Cook Time (min)');
    this.servingsInput       = page.getByLabel('Servings');
    this.tagsInput           = page.getByLabel(/Tags/);
    this.notesTextarea       = page.getByLabel('Notes');
    this.addIngredientButton = page.getByRole('button', { name: '+ Add Ingredient' });
    this.addStepButton       = page.getByRole('button', { name: '+ Add Step' });
    // Submit label varies: "Create Recipe" or "Update Recipe"
    this.submitButton        = page.getByRole('button', { name: /Create Recipe|Update Recipe/ });
    this.errorMessage        = page.locator('p.text-terracotta-600');
  }

  /** Returns the Name input for ingredient row i (0-indexed). */
  ingredientName(i: number): Locator {
    return this.page.locator('input[placeholder="Name"]').nth(i);
  }

  /** Returns the Amount input for ingredient row i (0-indexed). */
  ingredientAmount(i: number): Locator {
    return this.page.locator('input[placeholder="Amount"]').nth(i);
  }

  /** Returns the Unit input for ingredient row i (0-indexed). */
  ingredientUnit(i: number): Locator {
    return this.page.locator('input[placeholder="Unit (g, cup\u2026)"]').nth(i);
  }
}
```

---

## 2. Suite: Auth

**File:** `e2e/auth.spec.ts`
**Viewports:** Chromium desktop + Pixel 5 mobile (all tests run on both unless marked Desktop-only)

**Suite-level setup:**

```typescript
import { test, expect } from '@playwright/test';
import { clearDatabase } from './helpers/db.helper';
import { registerUser, loginUser, logoutUser } from './helpers/auth.helper';
import { LoginPagePO } from './page-objects/LoginPage.po';
import { RegisterPagePO } from './page-objects/RegisterPage.po';

test.beforeEach(async () => {
  await clearDatabase();
});
```

### Test cases

| # | Test name | Steps | Assert |
|---|-----------|-------|--------|
| A-01 | Register with valid credentials lands on /recipes and shows username in NavBar | 1. Navigate to `/register`. 2. Fill Username with `newuser`. 3. Fill Email with `newuser@test.com`. 4. Fill Password with `password123`. 5. Click `Create Account`. | URL is `/recipes`. NavBar contains the text `newuser`. |
| A-02 | Register with duplicate username shows error on register page | 1. Call `registerUser(page, { username: 'dupeuser', email: 'first@test.com', password: 'pass123' })` to seed an existing user. 2. Navigate to `/register`. 3. Fill Username with `dupeuser`. 4. Fill Email with `second@test.com`. 5. Fill Password with `pass123`. 6. Click `Create Account`. | URL remains `/register`. The error paragraph (`p.text-terracotta-600`) is visible and contains the text `already` (case-insensitive, e.g. "Username already taken" or similar backend message). |
| A-03 | Register with duplicate email shows error on register page | 1. Call `registerUser(page, { username: 'firstuser', email: 'shared@test.com', password: 'pass123' })`. 2. Navigate to `/register`. 3. Fill Username with `seconduser`. 4. Fill Email with `shared@test.com`. 5. Fill Password with `pass123`. 6. Click `Create Account`. | URL remains `/register`. Error paragraph is visible and contains `already`. |
| A-04 | Register with password shorter than 6 characters is blocked before submission | 1. Navigate to `/register`. 2. Fill Username with `shortpass`. 3. Fill Email with `shortpass@test.com`. 4. Fill Password with `abc`. 5. Click `Create Account`. | The browser's native validation prevents form submission (the input's `minLength` attribute is `6`). URL remains `/register`. No network request is made (verify via `page.on('request')`). |
| A-05 | Login with username navigates to /recipes and shows username in NavBar | 1. Call `registerUser(page, { username: 'loginuser', email: 'login@test.com', password: 'pass123' })`. 2. Navigate to `/login`. 3. Fill Username with `loginuser`. 4. Fill Password with `pass123`. 5. Click `Sign In`. | URL is `/recipes`. NavBar contains the text `loginuser`. |
| A-06 | Login with email in the username field navigates to /recipes (BUG-002 fix) | 1. Call `registerUser(page, { username: 'emaillogin', email: 'emaillogin@test.com', password: 'pass123' })`. 2. Navigate to `/login`. 3. Fill the Username field with `emaillogin@test.com` (the user's email address). 4. Fill Password with `pass123`. 5. Click `Sign In`. | URL is `/recipes`. NavBar contains the text `emaillogin`. |
| A-07 | Login with wrong password shows 401 error message | 1. Call `registerUser(page, { username: 'wrongpass', email: 'wrongpass@test.com', password: 'correct123' })`. 2. Navigate to `/login`. 3. Fill Username with `wrongpass`. 4. Fill Password with `wrongpassword`. 5. Click `Sign In`. | URL remains `/login`. Error paragraph is visible and contains `Invalid credentials`. The `Sign In` button is re-enabled (not stuck in loading state). |
| A-08 | Login with non-existent username shows 401 error message | 1. Navigate to `/login`. 2. Fill Username with `ghostuser`. 3. Fill Password with `anypass123`. 4. Click `Sign In`. | URL remains `/login`. Error paragraph is visible and contains `Invalid credentials`. |
| A-09 | Logout redirects to /login and NavBar is no longer visible | 1. Call `registerUser` + `loginUser` to arrive at `/recipes`. 2. Click the `Logout` button in the NavBar. | URL is `/login`. The `<nav>` element is not present in the DOM (NavBar is only rendered inside `ProtectedRoute`). |
| A-10 | Browser back button after logout does not reveal the protected page | 1. `loginUser(page, ...)` to reach `/recipes`. 2. Click `Logout`. 3. Wait for URL `/login`. 4. Call `page.goBack()`. | URL is `/login` (the `ProtectedRoute` redirects back because the session is gone). The NavBar is not visible. |
| A-11 | Page refresh while logged in stays on /recipes and shows username | 1. `registerUser` + `loginUser` to arrive at `/recipes`. 2. Call `page.reload()`. 3. Wait for `networkidle`. | URL is `/recipes`. NavBar contains the registered username. (This validates session restore via the refresh-cookie flow in `AuthContext`.) |
| A-12 | Direct navigation to /recipes while logged out redirects to /login | 1. Ensure no session exists (fresh `clearDatabase` + new browser context). 2. Navigate directly to `/recipes`. | URL is `/login`. |
| A-13 | Direct navigation to /recipes/:id while logged out redirects to /login | 1. Ensure no session exists. 2. Navigate directly to `/recipes/000000000000000000000001`. | URL is `/login`. |
| A-14 | After login user lands on /recipes | 1. `registerUser` then `loginUser`. | URL is `/recipes`. (Baseline check that the post-login redirect destination is always `/recipes` and never an intermediate URL.) |
| A-15 | Mobile viewport: register, login, logout flow works on Pixel 5 | 1. (Run in `mobile-pixel5` project.) Navigate to `/register`. 2. Fill all fields. 3. Tap `Create Account`. 4. Wait for `/recipes`. 5. Tap `Logout`. | After step 4: URL is `/recipes`, NavBar shows username. After step 5: URL is `/login`. All form elements and buttons are within the viewport (no horizontal scroll required). |

---

## 3. Suite: Recipe CRUD

**File:** `e2e/recipe-crud.spec.ts`
**Viewports:** Chromium desktop + Pixel 5 mobile

**Suite-level setup:**

```typescript
import { test, expect } from '@playwright/test';
import { clearDatabase } from './helpers/db.helper';
import { registerUser, loginUser } from './helpers/auth.helper';
import { getAuthToken, createRecipeViaAPI } from './helpers/recipe.helper';
import { RecipesPagePO } from './page-objects/RecipesPage.po';
import { RecipeDetailPagePO } from './page-objects/RecipeDetailPage.po';
import { RecipeFormPO } from './page-objects/RecipeForm.po';

// Shared test credentials
const USER = { username: 'recipeuser', email: 'recipe@test.com', password: 'pass123' };

test.beforeEach(async ({ page }) => {
  await clearDatabase();
  await registerUser(page, USER);
  // loginUser is called inside individual tests where needed, or here if all tests need it
  await loginUser(page, { username: USER.username, password: USER.password });
});
```

### Test cases

| # | Test name | Steps | Assert |
|---|-----------|-------|--------|
| C-01 | Create recipe with all fields appears in recipe list | 1. Navigate to `/recipes/new`. 2. Fill Title with `Full Recipe`. 3. Select Category `Dinner`. 4. Select Difficulty `Easy`. 5. Fill Prep Time with `10`. 6. Fill Cook Time with `20`. 7. Fill Servings with `2`. 8. Fill ingredient 0 Name with `Pasta`, Amount with `200`, Unit with `g`. 9. Fill Tags with `italian, quick`. 10. Fill Notes with `Great dish`. 11. Fill instruction step 0 with `Boil water`. 12. Click `Create Recipe`. | URL is `/recipes` (navigated back after creation — note: `CreateRecipePage.handleSubmit` navigates to `/recipes`, not the new detail page). A `RecipeCard` with the `h3` text `Full Recipe` is visible in the recipe grid. |
| C-02 | Create recipe with only required fields (title + 1 ingredient) succeeds | 1. Navigate to `/recipes/new`. 2. Fill Title with `Minimal Recipe`. 3. Fill ingredient 0 Name with `Egg`, Amount with `2`, Unit with `whole`. 4. Click `Create Recipe`. | URL is `/recipes`. A card with text `Minimal Recipe` is visible. |
| C-03 | Create recipe: submitting with empty title shows validation error and does not navigate | 1. Navigate to `/recipes/new`. 2. Leave Title empty. 3. Fill ingredient 0 Name with `Egg`, Amount with `1`, Unit with `whole`. 4. Click `Create Recipe`. | Browser native validation fires on the `required minLength={3}` title input. URL remains `/recipes/new`. No card is added to the recipe list (verify by navigating to `/recipes` after the attempt). |
| C-04 | Create recipe: submitting with title shorter than 3 characters shows validation and does not navigate | 1. Navigate to `/recipes/new`. 2. Fill Title with `AB` (2 characters). 3. Fill ingredient 0 Name with `Egg`, Amount with `1`, Unit with `whole`. 4. Click `Create Recipe`. | Browser native validation fires (`minLength={3}`). URL remains `/recipes/new`. |
| C-05 | Create recipe: submitting with no ingredients shows validation error | 1. Navigate to `/recipes/new`. 2. Fill Title with `No Ingredients`. 3. Leave all ingredient fields empty. 4. Click `Create Recipe`. | Browser native validation fires on the ingredient Name field (which is `required`). URL remains `/recipes/new`. |
| C-06 | View recipe detail displays all fields correctly | 1. Obtain an access token via `getAuthToken(USER.username, USER.password)`. 2. Call `createRecipeViaAPI(token, { title: 'Detail Recipe', category: 'Breakfast', difficulty: 'Hard', prepTime: 5, cookTime: 15, servings: 3, tags: ['egg', 'fast'], notes: 'My notes', ingredients: [{ name: 'Egg', amount: 3, unit: 'whole' }], instructions: ['Crack egg', 'Fry it'] })`. 3. Navigate to `/recipes`. 4. Click the card with title `Detail Recipe`. | URL is `/recipes/<id>`. Page `<h1>` text is `Detail Recipe`. Difficulty badge contains `Hard`. Text `Prep 5m` is visible. Text `Cook 15m` is visible. Text `20m total` is visible. Text `3 servings` is visible. Tag pill `egg` is visible. Tag pill `fast` is visible. Ingredients section contains `3 whole` and `Egg`. Instructions section shows `Crack egg` as step 1 and `Fry it` as step 2. Notes section contains `My notes`. |
| C-07 | Edit recipe: changing the title updates the title on the detail page | 1. Create a recipe via API with title `Old Title`. 2. Navigate to `/recipes`. 3. Click the `Old Title` card. 4. Click the `Edit` link. 5. Clear the Title field. 6. Fill Title with `New Title`. 7. Click `Update Recipe`. | URL is `/recipes/<id>` (the edit page navigates back to the detail page on success). Page `<h1>` text is `New Title`. |
| C-08 | Edit recipe: adding an ingredient makes it visible on the detail page | 1. Create a recipe via API with `{ title: 'Add Ingredient', ingredients: [{ name: 'Flour', amount: 200, unit: 'g' }] }`. 2. Navigate to the recipe detail page. 3. Click `Edit`. 4. Click `+ Add Ingredient`. 5. Fill the new row: Name `Sugar`, Amount `50`, Unit `g`. 6. Click `Update Recipe`. | URL returns to the detail page. Ingredients section contains `Sugar`. |
| C-09 | Edit recipe: form is pre-populated with existing data | 1. Create a recipe via API: `{ title: 'Prepop Recipe', category: 'Lunch', difficulty: 'Easy', tags: ['tag1', 'tag2'] }`. 2. Navigate to its detail page. 3. Click `Edit`. | Title field value is `Prepop Recipe`. Category select value is `Lunch`. Difficulty select value is `Easy`. Tags field value is `tag1, tag2`. |
| C-10 | Delete recipe: confirm flow removes recipe from list | 1. Create a recipe via API: `{ title: 'Delete Me' }`. 2. Navigate to `/recipes`. 3. Click the `Delete Me` card. 4. Click the `Delete` trigger button. 5. Click `Confirm`. | URL is `/recipes`. No card with title `Delete Me` is present in the recipe grid. |
| C-11 | Delete recipe: cancel flow keeps recipe on the detail page | 1. Create a recipe via API: `{ title: 'Keep Me' }`. 2. Navigate to the detail page for `Keep Me`. 3. Click the `Delete` trigger button. 4. Click `Cancel`. | URL remains `/recipes/<id>`. Page `<h1>` text is `Keep Me`. The `Delete` trigger button is visible again (ConfirmDialog is dismissed). |
| C-12 | Ownership: User B cannot view User A's recipe (returns error state) | 1. `clearDatabase()`. 2. Register and login as User A. 3. Create a recipe via API as User A; note the `_id`. 4. Logout. 5. Register and login as User B. 6. Navigate directly to `/recipes/<id-from-step-3>`. | The page shows the error text `Recipe not found.` and a `← My Recipes` link. URL remains `/recipes/<id>`. (The backend returns 404 because the recipe's `user` field does not match User B's `userId`.) |
| C-13 | XSS: recipe title containing script tag is rendered as plain text | 1. Create a recipe via API with `title: '<script>alert(1)</script>'`. 2. Navigate to `/recipes`. | No alert dialog appears. The card's `<h3>` element text content is the literal string `<script>alert(1)</script>`. 3. Click the card to open the detail page. | Page `<h1>` text content is the literal string `<script>alert(1)</script>`. No alert dialog appears. React's default JSX rendering (which escapes HTML entities) prevents script injection. |
| C-14 | Mobile viewport: create recipe form is usable and submittable on Pixel 5 | 1. (Run in `mobile-pixel5` project.) Navigate to `/recipes/new`. 2. Scroll as needed to reach each field. 3. Fill Title `Mobile Recipe`. 4. Fill ingredient 0: Name `Milk`, Amount `1`, Unit `cup`. 5. Tap `Create Recipe`. | URL is `/recipes`. A card with title `Mobile Recipe` is visible. All form fields were reachable without horizontal scrolling (assert by checking `page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)`). |

---

## 4. Suite: Search, Filter & Sort

**File:** `e2e/search-filter-sort.spec.ts`
**Viewports:** Chromium desktop + Pixel 5 mobile

**Suite-level setup:**

```typescript
import { test, expect } from '@playwright/test';
import { clearDatabase } from './helpers/db.helper';
import { registerUser, loginUser } from './helpers/auth.helper';
import { getAuthToken, createRecipeViaAPI } from './helpers/recipe.helper';
import { RecipesPagePO } from './page-objects/RecipesPage.po';

const USER = { username: 'filteruser', email: 'filter@test.com', password: 'pass123' };

// Seeded recipes (created once per test via beforeEach):
// 1. "Pasta Carbonara"    category: Dinner   tags: ['italian']
// 2. "Chicken Stir Fry"  category: Dinner   tags: ['quick']
// 3. "Pancakes"          category: Breakfast tags: ['sweet']
// 4. "Quick Oats"        category: Breakfast tags: ['quick', 'healthy']
// 5. "Apple Crumble"     category: Dessert   tags: ['sweet', 'baked']

test.beforeEach(async ({ page }) => {
  await clearDatabase();
  await registerUser(page, USER);
  await loginUser(page, { username: USER.username, password: USER.password });

  const token = await getAuthToken(USER.username, USER.password);
  await createRecipeViaAPI(token, {
    title: 'Pasta Carbonara', category: 'Dinner', tags: ['italian'],
    ingredients: [{ name: 'Pasta', amount: 200, unit: 'g' }],
  });
  await createRecipeViaAPI(token, {
    title: 'Chicken Stir Fry', category: 'Dinner', tags: ['quick'],
    ingredients: [{ name: 'Chicken', amount: 300, unit: 'g' }],
  });
  await createRecipeViaAPI(token, {
    title: 'Pancakes', category: 'Breakfast', tags: ['sweet'],
    ingredients: [{ name: 'Flour', amount: 200, unit: 'g' }],
  });
  await createRecipeViaAPI(token, {
    title: 'Quick Oats', category: 'Breakfast', tags: ['quick', 'healthy'],
    ingredients: [{ name: 'Oats', amount: 100, unit: 'g' }],
  });
  await createRecipeViaAPI(token, {
    title: 'Apple Crumble', category: 'Dessert', tags: ['sweet', 'baked'],
    ingredients: [{ name: 'Apple', amount: 3, unit: 'whole' }],
  });
});
```

### Test cases

| # | Test name | Steps | Assert |
|---|-----------|-------|--------|
| S-01 | Search by title returns only the matching recipe | 1. Navigate to `/recipes`. 2. Fill the search input with `Pasta`. 3. Press `Enter`. | URL contains `?q=Pasta`. Exactly 1 recipe card is visible. That card's `<h3>` text is `Pasta Carbonara`. Cards for `Pancakes`, `Chicken Stir Fry`, `Quick Oats`, and `Apple Crumble` are not present. |
| S-02 | Search by tag returns only recipes with that tag | 1. Navigate to `/recipes`. 2. Fill search input with `quick`. 3. Press `Enter`. | URL contains `?q=quick`. Cards for `Chicken Stir Fry` and `Quick Oats` are visible (both have tag `quick`). Cards for `Pasta Carbonara`, `Pancakes`, and `Apple Crumble` are not present. Total visible cards: 2. |
| S-03 | Clearing search restores all recipes | 1. Navigate to `/recipes?q=Pasta`. 2. Clear the search input (click the clear button or delete the text and press `Enter`). | URL does not contain `q=`. All 5 recipe cards are visible. |
| S-04 | Search with no matching results shows empty state message | 1. Navigate to `/recipes`. 2. Fill search input with `xyznonexistent`. 3. Press `Enter`. | URL contains `?q=xyznonexistent`. No recipe cards are visible. The text `No recipes match your search.` is visible on the page. |
| S-05 | Filter by category Dinner shows only Dinner recipes | 1. Navigate to `/recipes`. 2. Click the `Dinner` category pill. | URL contains `?category=Dinner`. Cards for `Pasta Carbonara` and `Chicken Stir Fry` are visible. Cards for `Pancakes`, `Quick Oats`, and `Apple Crumble` are not present. Total visible cards: 2. |
| S-06 | Filter by category All shows all recipes | 1. Navigate to `/recipes?category=Dinner`. 2. Click the `All` category pill. | URL does not contain `category=`. All 5 recipe cards are visible. |
| S-07 | Filter by category Breakfast shows only Breakfast recipes | 1. Navigate to `/recipes`. 2. Click the `Breakfast` category pill. | URL contains `?category=Breakfast`. Cards for `Pancakes` and `Quick Oats` are visible. Total visible cards: 2. |
| S-08 | Category filter combined with search returns correct subset | 1. Navigate to `/recipes`. 2. Click `Breakfast` category pill. 3. Fill search input with `quick`. 4. Press `Enter`. | URL contains both `category=Breakfast` and `q=quick`. Exactly 1 card is visible: `Quick Oats`. (`Chicken Stir Fry` is excluded by the Breakfast filter even though it has tag `quick`.) |
| S-09 | Sort by title ascending shows recipes in A to Z order | 1. Navigate to `/recipes`. 2. Change the sort control to `Title A→Z` (sets `?sort=title&order=asc`). | URL contains `sort=title` and `order=asc`. The first card title is `Apple Crumble`, the second is `Chicken Stir Fry`, the third is `Pancakes`, the fourth is `Pasta Carbonara`, the fifth is `Quick Oats`. |
| S-10 | Sort by title descending shows recipes in Z to A order | 1. Navigate to `/recipes`. 2. Change the sort control to `Title Z→A` (sets `?sort=title&order=desc`). | URL contains `sort=title` and `order=desc`. First card is `Quick Oats`, last card is `Apple Crumble`. |
| S-11 | Sort combined with category filter returns sorted subset | 1. Navigate to `/recipes`. 2. Click `Dinner` category pill. 3. Change sort to `Title A→Z`. | URL contains `category=Dinner`, `sort=title`, `order=asc`. Exactly 2 cards are visible. First card is `Chicken Stir Fry`, second is `Pasta Carbonara`. |
| S-12 | URL state preserved: search query survives page reload | 1. Navigate to `/recipes`. 2. Fill search input with `pasta`. 3. Press `Enter`. 4. Wait for URL `?q=pasta` and results to load. 5. Call `page.reload()`. 6. Wait for `networkidle`. | URL still contains `?q=pasta`. Exactly 1 card is visible: `Pasta Carbonara`. (Validates that `SearchBar` reads `initialValue` from the `q` URL param on mount.) |
| S-13 | URL state preserved: category filter survives navigating to detail and pressing back | 1. Navigate to `/recipes`. 2. Click `Dinner` category pill. 3. Wait for URL `?category=Dinner`. 4. Click the `Pasta Carbonara` card. 5. Wait for `/recipes/` URL. 6. Click `← My Recipes`. | URL is `/recipes?category=Dinner`. The `Dinner` pill has the active style. Cards for `Pasta Carbonara` and `Chicken Stir Fry` are visible. |
| S-14 | URL state preserved: sort + category open in a new tab restores same state | 1. Navigate to `/recipes?category=Dinner&sort=title&order=asc`. 2. Copy the full URL. 3. Open a new page (`browser.newPage()`) and navigate to that URL. | In the new tab: URL contains all three params. The `Dinner` pill is active. Two cards are visible. First card is `Chicken Stir Fry`. |
| S-15 | Mobile viewport: category pills are visible and scrollable on Pixel 5 | 1. (Run in `mobile-pixel5` project.) Navigate to `/recipes`. 2. Scroll the category pill row horizontally to find the `Dinner` pill. 3. Tap `Dinner`. | URL contains `?category=Dinner`. The `Dinner` pill has the active style (`.filter-pill-active`). No horizontal page scroll occurs (only the pill container scrolls). |

---

## 5. Suite: Navigation & Protected Routes

**File:** `e2e/navigation.spec.ts`
**Viewports:** Chromium desktop (navigation assertions are URL-based; mobile adds no distinct scenarios here, but all tests still run under `mobile-pixel5` in the project matrix)

**Suite-level setup:**

```typescript
import { test, expect } from '@playwright/test';
import { clearDatabase } from './helpers/db.helper';
import { registerUser, loginUser } from './helpers/auth.helper';
import { getAuthToken, createRecipeViaAPI } from './helpers/recipe.helper';

const USER = { username: 'navuser', email: 'nav@test.com', password: 'pass123' };

test.beforeEach(async ({ page }) => {
  await clearDatabase();
});
```

### Test cases

| # | Test name | Steps | Assert |
|---|-----------|-------|--------|
| N-01 | Unauthenticated visit to / redirects to /login | 1. Navigate to `/`. | Final URL is `/login`. (App.jsx has `<Route path="*" element={<Navigate to="/recipes" replace />}>`; ProtectedRoute then redirects to `/login` because the user is unauthenticated.) |
| N-02 | Unauthenticated visit to /recipes redirects to /login | 1. Navigate to `/recipes`. | Final URL is `/login`. |
| N-03 | Unauthenticated visit to /recipes/new redirects to /login | 1. Navigate to `/recipes/new`. | Final URL is `/login`. |
| N-04 | Unauthenticated visit to /recipes/some-id redirects to /login | 1. Navigate to `/recipes/000000000000000000000001`. | Final URL is `/login`. |
| N-05 | Unauthenticated visit to /recipes/some-id/edit redirects to /login | 1. Navigate to `/recipes/000000000000000000000001/edit`. | Final URL is `/login`. |
| N-06 | Unknown route /foobar redirects to /recipes, then to /login when unauthenticated | 1. Navigate to `/foobar`. | Final URL is `/login`. (The wildcard route redirects to `/recipes`; ProtectedRoute redirects to `/login`.) |
| N-07 | NavBar "My Recipes" link navigates to /recipes | 1. `registerUser` + `loginUser` (page, USER). 2. Navigate to `/recipes/new`. 3. Click the NavBar link with text `My Recipes`. | URL is `/recipes`. |
| N-08 | NavBar "+ New Recipe" button navigates to /recipes/new | 1. `registerUser` + `loginUser`. 2. Navigate to `/recipes`. 3. Click the NavBar link with text `+ New Recipe`. | URL is `/recipes/new`. |
| N-09 | RecipesPage "+ New Recipe" link (in page header) navigates to /recipes/new | 1. `registerUser` + `loginUser`. 2. Navigate to `/recipes`. 3. Click the `+ New Recipe` link in the page header (not the NavBar — it is the second element matching `role=link, name="+ New Recipe"`). | URL is `/recipes/new`. |
| N-10 | RecipeDetailPage "Edit" button navigates to /recipes/:id/edit | 1. `registerUser` + `loginUser`. 2. Create a recipe via API; note `_id`. 3. Navigate to `/recipes/<id>`. 4. Click the `Edit` link. | URL is `/recipes/<id>/edit`. |
| N-11 | RecipeDetailPage "← My Recipes" link navigates to /recipes | 1. `registerUser` + `loginUser`. 2. Create a recipe via API. 3. Navigate to `/recipes/<id>`. 4. Click `← My Recipes`. | URL is `/recipes`. |
| N-12 | CreateRecipePage after successful submit navigates to /recipes | 1. `registerUser` + `loginUser`. 2. Navigate to `/recipes/new`. 3. Fill Title `Nav Test Recipe`. 4. Fill ingredient: Name `Salt`, Amount `1`, Unit `tsp`. 5. Click `Create Recipe`. | URL is `/recipes`. (Confirms `CreateRecipePage.handleSubmit` calls `navigate('/recipes')` on success.) |
| N-13 | EditRecipePage "← Back to Recipe" link navigates to the recipe detail page | 1. `registerUser` + `loginUser`. 2. Create a recipe via API; note `_id`. 3. Navigate to `/recipes/<id>/edit`. 4. Click the `← Back to Recipe` link. | URL is `/recipes/<id>`. |

---

## 6. Suite: Session Resilience

**File:** `e2e/session.spec.ts`
**Viewports:** Chromium desktop only (these tests involve timing, cookies, and tab management — mobile adds no distinct scenarios)

**Suite-level setup:**

```typescript
import { test, expect, chromium, Browser } from '@playwright/test';
import { clearDatabase } from './helpers/db.helper';
import { registerUser, loginUser } from './helpers/auth.helper';
import { getAuthToken, createRecipeViaAPI } from './helpers/recipe.helper';

const USER = { username: 'sessionuser', email: 'session@test.com', password: 'pass123' };

test.beforeEach(async ({ page }) => {
  await clearDatabase();
  await registerUser(page, USER);
  await loginUser(page, { username: USER.username, password: USER.password });
});
```

### Test cases

| # | Test name | Steps | Assert |
|---|-----------|-------|--------|
| SR-01 | Silent token refresh: expired access token is refreshed transparently on the next API call | **Precondition:** Restart the backend with `ACCESS_TOKEN_EXPIRES_IN=2s` (use a dedicated fixture that spawns a second backend process on an alternate port, or configure the test DB to use a backend instance seeded with this env var). 1. `registerUser` + `loginUser`. 2. Wait 3 seconds (`page.waitForTimeout(3000)`) so the 2-second access token expires. 3. Navigate to `/recipes` (triggers `getAllRecipes` API call). | URL is `/recipes`. Recipe list loads without an error message. No redirect to `/login` occurs. (The Axios response interceptor in `AuthContext` catches the 401, calls `/api/auth/refresh`, receives a new access token, and retries the original request.) **Implementation note:** Set `ACCESS_TOKEN_EXPIRES_IN=2s` via the backend process environment in `globalSetup` for this suite only, or use `test.use({ storageState: ... })` combined with a backend fixture. Document the chosen approach in the test file's header comment. |
| SR-02 | Concurrent tabs: logout in tab 1 causes the next action in tab 2 to result in redirect to /login | 1. Open a second browser context/page (`browser.newContext()` + `newPage()`). 2. Navigate tab 2 to `/recipes`. 3. In tab 1, click `Logout`. Wait for URL `/login`. 4. In tab 2, trigger a navigation to `/recipes/new`. | Tab 2's URL becomes `/login`. (After logout, the backend clears `User.refreshToken`. The next request from tab 2 will receive a 401, the Axios interceptor will attempt `/api/auth/refresh` which will fail because the refresh token is invalidated, causing the interceptor to redirect to `/login`. **Note:** This behaviour depends on the silent refresh interceptor's error handling path — document the expected error path in the test.) |
| SR-03 | Externally cleared refreshToken cookie causes page refresh to redirect to /login | 1. `registerUser` + `loginUser` to reach `/recipes`. 2. Delete the `refreshToken` cookie via `page.context().clearCookies()`. 3. Call `page.reload()`. 4. Wait for navigation to settle. | URL is `/login`. (On reload, `AuthContext` calls `/api/auth/refresh`. Without the cookie the server returns 401/403. `AuthContext` catches the failure, sets `user` to `null`, and `ProtectedRoute` redirects to `/login`.) |
| SR-04 | Invalid MongoDB ObjectId in URL shows error state with back link | 1. `registerUser` + `loginUser`. 2. Navigate to `/recipes/not-a-valid-objectid`. | The page displays the text `Recipe not found.` The `← My Recipes` link is visible and clickable. URL remains `/recipes/not-a-valid-objectid`. (The backend returns 400 or 500 for an invalid ObjectId format; `RecipeDetailPage` catches the error and renders the error state.) |
| SR-05 | Slow network: create recipe shows loading state on submit button and does not double-submit | 1. `registerUser` + `loginUser`. 2. Navigate to `/recipes/new`. 3. Apply Playwright network throttling: `await page.route('**/api/recipes', async route => { await new Promise(r => setTimeout(r, 2000)); await route.continue(); })`. 4. Fill Title `Slow Recipe`. 5. Fill ingredient: Name `Water`, Amount `1`, Unit `cup`. 6. Click `Create Recipe`. 7. Immediately check the submit button text. 8. Click the `Create Recipe` button a second time (attempt to double-submit). | While the request is in flight: the submit button is `disabled` and its text is `Saving…`. After the request resolves: exactly 1 recipe card with title `Slow Recipe` appears on `/recipes`. (The `loading` state in `RecipeForm` disables the submit button, preventing double submission.) |

---

## 7. Mobile-Specific Considerations

This section documents the rules and adjustments that apply when running the full test matrix on `mobile-pixel5` (393 × 851 viewport, touch) and `mobile-iphone12` (390 × 844 viewport, touch).

### 7.1 Viewport projects

All suites run under all three Playwright projects:

| Project | Device | Viewport | Touch |
|---------|--------|----------|-------|
| `chromium-desktop` | Desktop Chrome | 1280 × 720 | No |
| `mobile-pixel5` | Pixel 5 | 393 × 851 | Yes |
| `mobile-iphone12` | iPhone 12 | 390 × 844 | Yes |

### 7.2 `click()` vs `tap()` on mobile

Playwright's `locator.click()` works on both desktop and mobile viewports because Playwright synthesizes the appropriate pointer events. Do not use `locator.tap()` unless a specific component registers a `touchstart` handler that `click()` does not trigger. As of the current implementation (no custom touch handlers in NavBar, RecipeForm, CategoryFilter, or ConfirmDialog), `click()` is correct for all projects.

### 7.3 NavBar on mobile

The NavBar renders a horizontal flex row containing: brand link, `My Recipes` link, `+ New Recipe` button, username span, and `Logout` button. On a 393px viewport, this row may clip if the username is long.

**Requirement:** All NavBar interactive elements (My Recipes, + New Recipe, Logout) must be within the viewport and not require horizontal scrolling of the page.

**Assertion to add to A-15 and any mobile-specific test:**
```typescript
// Assert no horizontal page scroll
const hasHorizontalScroll = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth
);
expect(hasHorizontalScroll).toBe(false);
```

**If this assertion fails:** The NavBar layout needs a responsive breakpoint (hamburger menu or column layout below a breakpoint). File a UI bug and mark the test with `test.fail()` until resolved.

### 7.4 CategoryFilter on mobile

The `CategoryFilter` renders a row of `.filter-pill` buttons (All, Breakfast, Lunch, Dinner, Snack, Dessert, Drink, Other — 8 pills). On a 393px viewport, these overflow horizontally. The expected behaviour is that the pill container scrolls horizontally (overflow-x: auto or scroll) while the page itself does not scroll horizontally.

**Assertion for S-15:**
```typescript
// The category pill container scrolls, but the page does not
const pillContainer = page.locator('.flex.gap-2').first(); // adjust selector to the CategoryFilter wrapper
const containerScrollWidth = await pillContainer.evaluate(el => el.scrollWidth);
const containerClientWidth = await pillContainer.evaluate(el => el.clientWidth);
// Container is wider than its visible area — internal scroll is active
expect(containerScrollWidth).toBeGreaterThan(containerClientWidth);

// But the page itself has no horizontal scroll
const pageHasHorizontalScroll = await page.evaluate(
  () => document.documentElement.scrollWidth > window.innerWidth
);
expect(pageHasHorizontalScroll).toBe(false);
```

**To scroll to a pill on mobile before clicking:**
```typescript
const dinnerPill = page.locator('.filter-pill, .filter-pill-active').filter({ hasText: 'Dinner' });
await dinnerPill.scrollIntoViewIfNeeded();
await dinnerPill.click();
```

### 7.5 RecipeForm on mobile

The form renders in a single column (`flex-col`) which is already mobile-friendly. The three-column grid for Prep Time / Cook Time / Servings (`grid-cols-3`) may be too narrow on a 393px viewport — each column would be approximately 120px.

**Assertion for C-14:**
```typescript
// Every labeled input is within the visible viewport width (no input clips off the right edge)
const inputs = page.locator('input, textarea, select');
const count  = await inputs.count();
for (let i = 0; i < count; i++) {
  const box = await inputs.nth(i).boundingBox();
  if (box) {
    expect(box.x + box.width).toBeLessThanOrEqual(393 + 1); // +1 for subpixel tolerance
  }
}
```

### 7.6 Toast notifications on mobile

The `ToastContext` / `Toast` component renders notifications that may be obscured by the mobile software keyboard when a form field is focused.

**Rule:** Toast assertions must wait for the keyboard to dismiss before asserting visibility. In Playwright on mobile viewports, the keyboard is not actually shown (it is a simulated viewport), so this is a documentation note for manual QA rather than an automated test constraint.

**Automated assertion:** After a successful create/edit/delete action that triggers a toast, assert:
```typescript
const toast = page.locator('[role="status"], [role="alert"]'); // adjust to Toast component's ARIA role
await expect(toast).toBeVisible({ timeout: 3000 });
```

### 7.7 Test annotations for mobile-only failures

When a test is expected to fail on mobile due to a known layout issue, annotate it explicitly:

```typescript
test('NavBar fits without horizontal scroll on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'chromium-desktop', 'Desktop-only layout is not constrained');
  // ... assertions
});
```

Use `test.fail()` (not `test.skip()`) when the behaviour is a known bug that must be fixed:

```typescript
test('NavBar long username does not overflow on Pixel 5', async ({ page }, testInfo) => {
  test.fail(testInfo.project.name.startsWith('mobile'), 'BUG: NavBar overflows with username > 12 chars on mobile — ticket #XXX');
  // ... assertions
});
```

---

## Appendix A: Seed Data Reference

All API-seeded recipes use the following minimal valid shape (any omitted optional field uses the schema default):

```typescript
// Minimum valid recipe (only required fields)
{
  title: 'Recipe Title',           // required, minLength 3
  ingredients: [
    { name: 'Ingredient', amount: 1, unit: 'whole' }  // all three sub-fields required
  ]
}

// Full recipe (all optional fields)
{
  title: 'Full Recipe',
  category: 'Dinner',             // enum: Breakfast|Lunch|Dinner|Snack|Dessert|Drink|Other
  difficulty: 'Easy',             // enum: Easy|Medium|Hard  default: 'Medium'
  prepTime: 10,                   // minutes
  cookTime: 20,                   // minutes
  servings: 4,
  tags: ['tag1', 'tag2'],         // text-indexed for search
  notes: 'Extra notes here.',
  ingredients: [
    { name: 'Pasta', amount: 200, unit: 'g' }
  ],
  instructions: ['Step one.', 'Step two.']
}
```

---

## Appendix B: Known Limitations & Future Test Work

| Item | Description | Priority |
|------|-------------|----------|
| Rate limiting tests | `express-rate-limit` is applied to auth routes (10 req / 15 min). Add a suite that submits 11 login attempts and asserts a 429 response. | High |
| Input validation (Zod) | Backend uses Zod schemas on POST/PATCH routes. Add API-level tests (not E2E) that send malformed payloads and assert 400 + error message shape. | High |
| Image upload | When `ImageUpload` component is implemented, add C-15: upload an image, verify it appears on the detail card. | Medium |
| Friends / social | When `FriendsPage` is implemented, add a `friends.spec.ts` suite covering request, accept, and decline flows. | Low |
| Recipe sharing | When `ShareModal` is implemented, add `sharing.spec.ts`. | Low |
| Accessibility | Add `axe-playwright` assertions to each page's smoke test to catch WCAG 2.1 AA violations. | Medium |
| Visual regression | Add a `screenshots.spec.ts` using Playwright's `toHaveScreenshot()` for pixel-diff regression on RecipeCard, RecipeDetailPage, and NavBar. | Low |
