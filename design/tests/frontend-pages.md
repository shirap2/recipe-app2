# Frontend Pages — Test Design Document

**Scope:** Unit/integration tests for all six page components.
**Framework:** Vitest + React Testing Library + @testing-library/user-event v14.

---

## Global Mock Conventions

Every test file imports and applies the following mocks. Establish these at the top of each file before any `describe` block.

```js
import { vi } from 'vitest';

// ── API modules ────────────────────────────────────────────────────────────
vi.mock('../../../api/recipesApi');
vi.mock('../../../api/authApi');

// ── Auth hook ──────────────────────────────────────────────────────────────
// Override per test with mockReturnValue({ login, register, logout, user })
vi.mock('../../../hooks/useAuth');

// ── React Router – preserve all real exports, only stub useNavigate ────────
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
```

Reset all mocks in a `beforeEach`:

```js
import { beforeEach } from 'vitest';
beforeEach(() => {
  vi.resetAllMocks();
  mockNavigate.mockReset();
});
```

### Shared test fixtures

```js
// Minimal valid recipe (only required fields)
export const minimalRecipe = {
  _id: 'abc123',
  title: 'Plain Toast',
  category: 'Breakfast',
  difficulty: 'Easy',
  ingredients: [],
  instructions: [],
  tags: [],
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Fully populated recipe
export const fullRecipe = {
  _id: 'abc123',
  title: 'Classic Pasta Carbonara',
  category: 'Dinner',
  difficulty: 'Medium',
  prepTime: 15,
  cookTime: 20,
  servings: 4,
  tags: ['italian', 'pasta', 'quick'],
  ingredients: [
    { name: 'Spaghetti', amount: 200, unit: 'g' },
    { name: 'Eggs', amount: 3, unit: '' },
  ],
  instructions: ['Boil pasta.', 'Mix eggs and cheese.', 'Combine.'],
  notes: 'Use guanciale for authenticity.',
  createdAt: '2026-02-15T00:00:00.000Z',
};
```

---

## LoginPage

**Test file:** `frontend/src/pages/__tests__/LoginPage.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
```js
vi.mock('../../../hooks/useAuth');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
```
**Router setup:**
```jsx
import { MemoryRouter } from 'react-router-dom';
// Wrap every render:
render(<MemoryRouter initialEntries={['/login']}><LoginPage /></MemoryRouter>);
```
**useAuth mock default (applied in beforeEach):**
```js
import useAuth from '../../../hooks/useAuth';
useAuth.mockReturnValue({ login: vi.fn() });
```

### Test cases

| # | Test name | Setup / preconditions | What to assert |
|---|-----------|----------------------|----------------|
| 1 | renders without crashing (smoke test) | `useAuth` returns `{ login: vi.fn() }` | `getByRole('heading', { name: /recipe app/i })` is in the document; `getByRole('button', { name: /sign in/i })` is in the document |
| 2 | renders username and password inputs | default setup | `getByPlaceholderText('your_username')` is in the document; password input found via `getByPlaceholderText('••••••••')` has `type="password"` |
| 3 | password field is type="password" (not readable) | default setup | `document.querySelector('input[name="password"]').type === 'password'` |
| 4 | username field has required attribute | default setup | `getByPlaceholderText('your_username')` has `required` attribute |
| 5 | password field has required attribute | default setup | `document.querySelector('input[name="password"]')` has `required` attribute |
| 6 | tab order is logical: username → password → submit | default setup | `getByPlaceholderText('your_username')` appears before password input in DOM order; password input appears before submit button in DOM order (use `document.querySelector` with positional comparison or check `compareDocumentPosition`) |
| 7 | "Create one" link navigates to /register | default setup | `getByRole('link', { name: /create one/i })` has `href` ending in `/register` |
| 8 | no error message on initial render | default setup | `queryByRole('paragraph')` containing error text is `null`; specifically `queryByText(/invalid credentials/i)` is `null` |
| 9 | button is not disabled on initial render | default setup | `getByRole('button', { name: /sign in/i })` does not have `disabled` attribute |
| 10 | typing into username field updates displayed value | default setup; `userEvent.type(usernameInput, 'alice')` | `getByDisplayValue('alice')` is in the document |
| 11 | typing into password field updates displayed value | default setup; `userEvent.type(passwordInput, 'secret')` | `getByDisplayValue('secret')` is in the document |
| 12 | successful login calls login() with correct args then navigates | `login` mock resolves; type 'alice' into username, 'secret123' into password, click Sign In | `login` was called with `('alice', 'secret123')`; `mockNavigate` was called with `'/recipes'` |
| 13 | button shows "Signing in…" and is disabled while login() is pending | `login` mock returns a never-resolving Promise (`new Promise(() => {})`); type credentials, click Sign In | `getByRole('button', { name: /signing in…/i })` is in the document; that button has `disabled` attribute |
| 14 | button reverts to "Sign In" after login() resolves | `login` mock resolves immediately; type credentials, click Sign In, await resolution | `getByRole('button', { name: /sign in/i })` is in the document; button does not have `disabled` attribute |
| 15 | API returns 401 — shows error message from response body | `login` mock rejects with `{ response: { data: { message: 'Invalid credentials' } } }`; submit form | `getByText('Invalid credentials')` is in the document; `mockNavigate` was NOT called |
| 16 | API returns 400 — shows error message from response body | `login` mock rejects with `{ response: { data: { message: 'Username required' } } }` | `getByText('Username required')` is in the document |
| 17 | API error with no response.data.message — shows fallback text | `login` mock rejects with `new Error('Network Error')` (no `.response`) | `getByText('Invalid credentials. Please try again.')` is in the document |
| 18 | rate limit (429) — shows error message from response body | `login` mock rejects with `{ response: { status: 429, data: { message: 'Too many requests, please try again later.' } } }` | `getByText('Too many requests, please try again later.')` is in the document |
| 19 | error is cleared on a new submit attempt | `login` first rejects (triggers error text), then resolves; submit once (error appears), submit again | after second submit resolves: `queryByText(/invalid credentials/i)` is `null` |
| 20 | native validation blocks submit when username is empty | username left empty, password filled, form submitted via `userEvent.click(submitButton)` | `login` was NOT called (browser `required` constraint fires before `handleSubmit`); verify with `expect(login).not.toHaveBeenCalled()` |
| 21 | native validation blocks submit when password is empty | password left empty, username filled, form submitted | `login` was NOT called |
| 22 | accessibility: page has a single h1 | default setup | `getAllByRole('heading', { level: 1 })` has length 1 and its text is 'Recipe App' |
| 23 | accessibility: form inputs have visible labels | default setup | `getByLabelText(/username/i)` resolves (label "Username" associates with input); `getByLabelText(/password/i)` resolves |

---

## RegisterPage

**Test file:** `frontend/src/pages/__tests__/RegisterPage.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
```js
vi.mock('../../../hooks/useAuth');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
```
**Router setup:**
```jsx
render(<MemoryRouter initialEntries={['/register']}><RegisterPage /></MemoryRouter>);
```
**useAuth mock default:**
```js
useAuth.mockReturnValue({ register: vi.fn() });
```

### Test cases

| # | Test name | Setup / preconditions | What to assert |
|---|-----------|----------------------|----------------|
| 1 | renders without crashing (smoke test) | default setup | `getByRole('heading', { name: /recipe app/i })` is in the document; `getByRole('button', { name: /create account/i })` is in the document |
| 2 | renders username, email, and password fields | default setup | `getByPlaceholderText('your_username')` exists; `getByPlaceholderText('you@example.com')` exists; `getByPlaceholderText('••••••••')` exists |
| 3 | subtitle text indicates registration context | default setup | `getByText('Create your free account')` is in the document |
| 4 | password field is type="password" | default setup | `document.querySelector('input[name="password"]').type === 'password'` |
| 5 | email field is type="email" | default setup | `document.querySelector('input[name="email"]').type === 'email'` |
| 6 | password field has minLength=6 | default setup | `document.querySelector('input[name="password"]').minLength === 6` |
| 7 | "At least 6 characters." hint text is visible | default setup | `getByText('At least 6 characters.')` is in the document |
| 8 | all three inputs have required attribute | default setup | username input, email input, and password input each have `required` attribute |
| 9 | tab order is logical: username → email → password → submit | default setup | username input, email input, password input, and submit button appear in that sequential DOM order (verify via `compareDocumentPosition` or index in `getAllByRole`) |
| 10 | "Sign in" link navigates to /login | default setup | `getByRole('link', { name: /sign in/i })` has `href` ending in `/login` |
| 11 | no error message on initial render | default setup | `queryByText(/registration failed/i)` is `null` |
| 12 | successful registration calls register() with correct args then navigates | `register` mock resolves; fill username='bob', email='bob@test.com', password='pass123'; click Create Account | `register` was called with `('bob', 'bob@test.com', 'pass123')`; `mockNavigate` was called with `'/recipes'` |
| 13 | button shows "Creating account…" and is disabled while register() is pending | `register` mock returns `new Promise(() => {})`; fill all fields; click submit | `getByRole('button', { name: /creating account…/i })` is in the document; that button has `disabled` attribute |
| 14 | button reverts to "Create Account" after register() resolves | `register` mock resolves; complete full submit flow | `getByRole('button', { name: /create account/i })` exists and does not have `disabled` attribute |
| 15 | API returns 400 (username taken) — shows message from response | `register` mock rejects with `{ response: { data: { message: 'Username already taken' } } }` | `getByText('Username already taken')` is in the document; `mockNavigate` was NOT called |
| 16 | API returns 400 (email taken) — shows message from response | `register` mock rejects with `{ response: { data: { message: 'Email already in use' } } }` | `getByText('Email already in use')` is in the document |
| 17 | API error with no response.data.message — shows fallback text | `register` mock rejects with `new Error('Network Error')` | `getByText('Registration failed. Please try again.')` is in the document |
| 18 | rate limit (429) — shows message from response | `register` mock rejects with `{ response: { status: 429, data: { message: 'Too many requests, please try again later.' } } }` | `getByText('Too many requests, please try again later.')` is in the document |
| 19 | native validation blocks submit when username is empty | username empty, email and password filled; click submit | `register` was NOT called |
| 20 | native validation blocks submit when email is empty | email empty, username and password filled; click submit | `register` was NOT called |
| 21 | native validation blocks submit when password is empty | password empty, username and email filled; click submit | `register` was NOT called |
| 22 | native validation blocks submit when password is fewer than 6 characters | password = 'abc' (3 chars), other fields filled; click submit | `register` was NOT called (browser enforces `minLength={6}`) |
| 23 | accessibility: page has a single h1 | default setup | `getAllByRole('heading', { level: 1 })` has length 1 |
| 24 | accessibility: all inputs have associated labels | default setup | `getByLabelText(/username/i)` resolves; `getByLabelText(/email/i)` resolves; `getByLabelText(/password/i)` resolves |

---

## RecipesPage

**Test file:** `frontend/src/pages/__tests__/RecipesPage.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
```js
vi.mock('../../../api/recipesApi');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
// Note: useAuth is NOT mocked here — pages are rendered without ProtectedRoute
```
**Router setup:**
```jsx
// Parameterize via initialEntries to test URL-driven state:
render(
  <MemoryRouter initialEntries={['/recipes?q=pasta']}>
    <Routes>
      <Route path="/recipes" element={<RecipesPage />} />
    </Routes>
  </MemoryRouter>
);
```
**API mock defaults (applied per test):**
```js
import * as recipesApi from '../../../api/recipesApi';
// Successful empty list:
recipesApi.getAllRecipes.mockResolvedValue([]);
// Successful with data:
recipesApi.getAllRecipes.mockResolvedValue([fullRecipe, minimalRecipe]);
// Search:
recipesApi.searchRecipes.mockResolvedValue([fullRecipe]);
```

**Note on component mocking for unit isolation:** To keep tests focused on RecipesPage logic rather than child component internals, mock heavy child components:
```js
vi.mock('../../../components/RecipeCard', () => ({
  default: ({ recipe }) => <div data-testid="recipe-card">{recipe.title}</div>,
}));
vi.mock('../../../components/SearchBar', () => ({
  default: ({ onSearch, onClear, initialValue, isSearching }) => (
    <div>
      <input
        data-testid="search-input"
        defaultValue={initialValue}
        aria-label="Search recipes"
      />
      <button onClick={() => onSearch(initialValue)} data-testid="search-btn">Search</button>
      {isSearching && <button onClick={onClear} data-testid="clear-btn">Clear</button>}
    </div>
  ),
}));
vi.mock('../../../components/CategoryFilter', () => ({
  default: ({ value, onChange }) => (
    <div>
      <button data-testid="cat-all" aria-pressed={value === null} onClick={() => onChange(null)}>All</button>
      <button data-testid="cat-dinner" aria-pressed={value === 'Dinner'} onClick={() => onChange('Dinner')}>Dinner</button>
      <button data-testid="cat-breakfast" aria-pressed={value === 'Breakfast'} onClick={() => onChange('Breakfast')}>Breakfast</button>
    </div>
  ),
}));
vi.mock('../../../components/SortControls', () => ({
  default: ({ sort, order, onChange }) => (
    <div>
      <select aria-label="Sort by" value={sort} onChange={e => onChange(e.target.value, order)}>
        <option value="createdAt">Date added</option>
        <option value="title">Title</option>
      </select>
      <select aria-label="Sort order" value={order} onChange={e => onChange(sort, e.target.value)}>
        <option value="desc">Newest first</option>
        <option value="asc">Oldest first</option>
      </select>
    </div>
  ),
}));
```

### Test cases

| # | Test name | Setup / preconditions | What to assert |
|---|-----------|----------------------|----------------|
| 1 | renders without crashing (smoke test) | `getAllRecipes` resolves with `[]`; URL `/recipes` | `getByRole('heading', { name: /my recipes/i })` is in the document; `getByRole('link', { name: /\+ new recipe/i })` is in the document |
| 2 | shows loading state immediately on mount | `getAllRecipes` returns `new Promise(() => {})`; URL `/recipes` | `getByText('Loading…')` is in the document before the promise resolves |
| 3 | loading indicator disappears after data loads | `getAllRecipes` resolves with `[fullRecipe]`; await `waitForElementToBeRemoved` | `queryByText('Loading…')` is `null` after resolution |
| 4 | renders recipe cards for each recipe returned | `getAllRecipes` resolves with `[fullRecipe, minimalRecipe]`; await resolution | `getAllByTestId('recipe-card')` has length 2; `getByText('Classic Pasta Carbonara')` is in the document; `getByText('Plain Toast')` is in the document |
| 5 | empty state — no recipes exist | `getAllRecipes` resolves with `[]`; URL `/recipes` | `getByText("You haven't added any recipes yet.")` is in the document; `getByRole('link', { name: /create your first recipe/i })` is in the document |
| 6 | API failure — shows error message (not empty state) | `getAllRecipes` rejects with `new Error('Network Error')`; await resolution | `getByText('Failed to load recipes.')` is in the document; `queryByText("You haven't added any recipes yet.")` is `null`; `queryAllByTestId('recipe-card')` has length 0 |
| 7 | URL param ?q=pasta on mount — searchRecipes called with 'pasta' | `searchRecipes` resolves with `[fullRecipe]`; URL `/recipes?q=pasta` | after `waitFor`: `recipesApi.searchRecipes` was called with `'pasta'`; `recipesApi.getAllRecipes` was NOT called |
| 8 | URL param ?q=pasta on mount — SearchBar initialValue is 'pasta' | `searchRecipes` resolves with `[]`; URL `/recipes?q=pasta`; using the mock SearchBar | `getByTestId('search-input')` has `defaultValue` of `'pasta'` |
| 9 | URL param ?category=Dinner on mount — getAllRecipes called with 'Dinner' | `getAllRecipes` resolves with `[]`; URL `/recipes?category=Dinner` | `recipesApi.getAllRecipes` was called with `'Dinner'` |
| 10 | URL param ?category=Dinner on mount — CategoryFilter 'Dinner' button has aria-pressed="true" | `getAllRecipes` resolves with `[]`; URL `/recipes?category=Dinner` | `getByTestId('cat-dinner')` has `aria-pressed="true"`; `getByTestId('cat-all')` has `aria-pressed="false"` |
| 11 | URL param ?sort=title&order=asc on mount — SortControls receives correct props | `getAllRecipes` resolves with `[]`; URL `/recipes?sort=title&order=asc` | `getByRole('combobox', { name: /sort by/i })` has `value` of `'title'`; `getByRole('combobox', { name: /sort order/i })` has `value` of `'asc'` |
| 12 | URL params ?q=pasta&category=Dinner — q takes precedence and searchRecipes is called | `searchRecipes` resolves with `[]`; URL `/recipes?q=pasta&category=Dinner` | `recipesApi.searchRecipes` was called with `'pasta'`; `recipesApi.getAllRecipes` was NOT called |
| 13 | sort by title ascending — recipes rendered in correct order | `getAllRecipes` resolves with `[{ ...minimalRecipe, title: 'Zucchini Soup' }, { ...fullRecipe, title: 'Apple Pie' }]`; URL `/recipes?sort=title&order=asc` | `getAllByTestId('recipe-card')[0]` has text `'Apple Pie'`; `getAllByTestId('recipe-card')[1]` has text `'Zucchini Soup'` |
| 14 | sort by title descending — recipes rendered in reverse order | same two recipes; URL `/recipes?sort=title&order=desc` | `getAllByTestId('recipe-card')[0]` has text `'Zucchini Soup'`; `getAllByTestId('recipe-card')[1]` has text `'Apple Pie'` |
| 15 | sort by createdAt descending — most recent first | `getAllRecipes` resolves with `[{ ...minimalRecipe, _id: 'old1', createdAt: '2026-01-01T00:00:00Z', title: 'Old Recipe' }, { ...fullRecipe, _id: 'new1', createdAt: '2026-03-01T00:00:00Z', title: 'New Recipe' }]`; URL `/recipes?sort=createdAt&order=desc` | `getAllByTestId('recipe-card')[0]` has text `'New Recipe'`; `getAllByTestId('recipe-card')[1]` has text `'Old Recipe'` |
| 16 | sort title comparison is case-insensitive via localeCompare | `getAllRecipes` resolves with `[{ ...minimalRecipe, title: 'banana bread' }, { ...fullRecipe, title: 'Apple Pie' }]`; URL `/recipes?sort=title&order=asc` | `getAllByTestId('recipe-card')[0]` has text `'Apple Pie'`; `getAllByTestId('recipe-card')[1]` has text `'banana bread'` (localeCompare handles case) |
| 17 | changing sort field updates URL params and re-renders | `getAllRecipes` resolves with `[fullRecipe]`; URL `/recipes`; `userEvent.selectOptions(getByRole('combobox', { name: /sort by/i }), 'title')` | `getByRole('combobox', { name: /sort by/i })` has `value` of `'title'`; `getAllRecipes` is only called once (sort is client-side) |
| 18 | changing sort order updates URL params | `getAllRecipes` resolves with `[fullRecipe]`; URL `/recipes`; `userEvent.selectOptions(sortOrderSelect, 'asc')` | `getByRole('combobox', { name: /sort order/i })` has `value` of `'asc'` |
| 19 | clicking a category button updates URL param and re-fetches | `getAllRecipes` resolves with `[]`; mount at `/recipes`; click `getByTestId('cat-dinner')` | after `waitFor`: `recipesApi.getAllRecipes` was called with `'Dinner'` (second call); URL should include `category=Dinner` |
| 20 | clicking "All" category clears category param | `getAllRecipes` resolves with `[]`; mount at `/recipes?category=Dinner`; click `getByTestId('cat-all')` | after `waitFor`: `recipesApi.getAllRecipes` was called with `null` in the second call |
| 21 | category param is preserved when a search is performed | `searchRecipes` resolves with `[]`; URL `/recipes?category=Dinner`; trigger a search for 'pasta' via mock SearchBar | `recipesApi.searchRecipes` was called with `'pasta'`; CategoryFilter 'Dinner' button still has `aria-pressed="true"` |
| 22 | search param is preserved when category changes | `getAllRecipes` resolves with `[]`; URL `/recipes?q=pasta`; click `getByTestId('cat-dinner')` | `recipesApi.searchRecipes` was called again; `getByTestId('search-input')` still has value `'pasta'` in URL (param preserved) |
| 23 | empty search string (clear) — calls getAllRecipes, not searchRecipes | `getAllRecipes` resolves with `[]`; URL `/recipes?q=pasta`; click `getByTestId('clear-btn')` | after `waitFor`: `recipesApi.getAllRecipes` was called; `recipesApi.searchRecipes` was NOT called in this second round |
| 24 | empty search result for query — shows search-specific empty message | `searchRecipes` resolves with `[]`; URL `/recipes?q=noresult` | `getByText('No recipes match your search.')` is in the document; `queryByText("You haven't added any recipes yet.")` is `null` |
| 25 | empty result for category — shows category-specific empty message | `getAllRecipes` resolves with `[]`; URL `/recipes?category=Dinner` | `getByText('No recipes in this category.')` is in the document |
| 26 | zero total recipes (no query, no category) — "Create your first recipe" link shown | `getAllRecipes` resolves with `[]`; URL `/recipes` | `getByRole('link', { name: /create your first recipe/i })` is in the document |
| 27 | zero recipes for a search — no "Create your first recipe" link | `searchRecipes` resolves with `[]`; URL `/recipes?q=nothing` | `queryByRole('link', { name: /create your first recipe/i })` is `null` |
| 28 | zero recipes for a category — no "Create your first recipe" link | `getAllRecipes` resolves with `[]`; URL `/recipes?category=Dinner` | `queryByRole('link', { name: /create your first recipe/i })` is `null` |
| 29 | "My Recipes" heading is present | `getAllRecipes` resolves with `[]`; URL `/recipes` | `getByRole('heading', { name: 'My Recipes' })` is in the document |
| 30 | "+ New Recipe" link points to /recipes/new | `getAllRecipes` resolves with `[]` | `getByRole('link', { name: /\+ new recipe/i })` has `href` ending in `/recipes/new` |
| 31 | getAllRecipes is called once on initial mount with no params | `getAllRecipes` resolves with `[]`; URL `/recipes` | after `waitFor`: `recipesApi.getAllRecipes` was called exactly 1 time with `null` |
| 32 | getAllRecipes is NOT called again when only sort/order params change | `getAllRecipes` resolves with `[fullRecipe]`; mount at `/recipes`; change sort select | `recipesApi.getAllRecipes` call count remains 1 (sort is client-side only) |
| 33 | accessibility: category filter group has an accessible label | `getAllRecipes` resolves with `[]` | `getByRole('group', { name: /filter by category/i })` is in the document |
| 34 | accessibility: search input has accessible label | `getAllRecipes` resolves with `[]` | `getByRole('searchbox', { name: /search recipes/i })` is in the document |

---

## RecipeDetailPage

**Test file:** `frontend/src/pages/__tests__/RecipeDetailPage.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
```js
vi.mock('../../../api/recipesApi');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
```
**Router setup:**
```jsx
// Provide the :id param via MemoryRouter + Routes:
render(
  <MemoryRouter initialEntries={['/recipes/abc123']}>
    <Routes>
      <Route path="/recipes/:id" element={<RecipeDetailPage />} />
    </Routes>
  </MemoryRouter>
);
```

### Test cases

| # | Test name | Setup / preconditions | What to assert |
|---|-----------|----------------------|----------------|
| 1 | renders without crashing (smoke test) | `getRecipeById` resolves with `fullRecipe` | after `waitFor`: `getByRole('heading', { level: 1, name: 'Classic Pasta Carbonara' })` is in the document |
| 2 | shows loading state before data arrives | `getRecipeById` returns `new Promise(() => {})`; render immediately | `getByText('Loading…')` is in the document |
| 3 | loading indicator disappears after data loads | `getRecipeById` resolves with `fullRecipe`; await resolution | `queryByText('Loading…')` is `null` |
| 4 | getRecipeById is called with the URL param id | `getRecipeById` resolves with `fullRecipe`; route param is 'abc123' | `recipesApi.getRecipeById` was called with `'abc123'` |
| 5 | fully populated recipe — all fields rendered | `getRecipeById` resolves with `fullRecipe` | `getByText('Classic Pasta Carbonara')`; `getByText('Medium')`; `getByText('Prep 15m')`; `getByText('Cook 20m')`; `getByText('35m total')`; `getByText('4 servings')`; `getByText('italian')`; `getByText('pasta')`; `getByText('quick')` are all in the document |
| 6 | minimal recipe — optional fields absent | `getRecipeById` resolves with `minimalRecipe` (no prepTime, cookTime, servings, tags, notes) | `queryByText(/prep/i)` is `null`; `queryByText(/cook/i)` is `null`; `queryByText(/total/i)` is `null`; `queryByText(/servings/i)` is `null`; tags section `queryByText('italian')` is `null`; notes section `queryByRole('heading', { name: /notes/i })` is `null` |
| 7 | recipe with prepTime=0 and cookTime=0 — total time row hidden | `getRecipeById` resolves with `{ ...fullRecipe, prepTime: 0, cookTime: 0 }` | `queryByText(/total/i)` is `null` (totalTime = 0, conditional renders nothing); `queryByText(/prep 0m/i)` is `null`; `queryByText(/cook 0m/i)` is `null` |
| 8 | recipe with tags — all tags shown | `getRecipeById` resolves with `{ ...fullRecipe, tags: ['italian', 'pasta', 'quick'] }` | `getByText('italian')`; `getByText('pasta')`; `getByText('quick')` are in the document |
| 9 | recipe with no tags — tag section not rendered | `getRecipeById` resolves with `{ ...fullRecipe, tags: [] }` | `queryByText('italian')` is `null`; the tag container div (wrapping span elements) is absent |
| 10 | recipe with ingredients — ingredients listed | `getRecipeById` resolves with `fullRecipe` | `getByText('Spaghetti')` is in the document; `getByText('Eggs')` is in the document |
| 11 | recipe with no ingredients — fallback text shown | `getRecipeById` resolves with `{ ...fullRecipe, ingredients: [] }` | `getByText('No ingredients listed.')` is in the document |
| 12 | recipe with instructions — all steps rendered | `getRecipeById` resolves with `fullRecipe` | `getByText('Boil pasta.')` is in the document; `getByText('Mix eggs and cheese.')` is in the document; `getByText('Combine.')` is in the document |
| 13 | recipe with no instructions — fallback text shown | `getRecipeById` resolves with `{ ...fullRecipe, instructions: [] }` | `getByText('No instructions listed.')` is in the document |
| 14 | recipe with notes — notes section rendered | `getRecipeById` resolves with `fullRecipe` | `getByRole('heading', { name: /notes/i })` is in the document; `getByText('Use guanciale for authenticity.')` is in the document |
| 15 | recipe with no notes — notes section absent | `getRecipeById` resolves with `{ ...fullRecipe, notes: '' }` | `queryByRole('heading', { name: /notes/i })` is `null` |
| 16 | "← My Recipes" back-link points to /recipes | `getRecipeById` resolves with `fullRecipe` | `getByRole('link', { name: /← my recipes/i })` has `href` ending in `/recipes` |
| 17 | Edit button links to /recipes/:id/edit | `getRecipeById` resolves with `fullRecipe` | `getByRole('link', { name: /edit/i })` has `href` ending in `/recipes/abc123/edit` |
| 18 | Delete button is visible on initial render | `getRecipeById` resolves with `fullRecipe` | `getByRole('button', { name: /delete/i })` is in the document |
| 19 | clicking Delete shows ConfirmDialog with message and confirm/cancel buttons | `getRecipeById` resolves with `fullRecipe`; `userEvent.click(getByRole('button', { name: /delete/i }))` | `getByText(/delete "classic pasta carbonara"\? this cannot be undone\./i)` is in the document; `getByRole('button', { name: /yes, delete/i })` is in the document; `getByRole('button', { name: /cancel/i })` is in the document |
| 20 | cancel in ConfirmDialog dismisses it, returning to Delete button | after triggering ConfirmDialog; `userEvent.click(getByRole('button', { name: /cancel/i }))` | `getByRole('button', { name: /delete/i })` is in the document again; `queryByRole('button', { name: /yes, delete/i })` is `null`; `recipesApi.deleteRecipe` was NOT called |
| 21 | confirming delete calls deleteRecipe with correct id and navigates | `deleteRecipe` resolves; trigger ConfirmDialog; click "Yes, delete" | `recipesApi.deleteRecipe` was called with `'abc123'`; `mockNavigate` was called with `'/recipes'` |
| 22 | delete API failure — error message shown, user stays on page | `deleteRecipe` rejects with `new Error('Server Error')`; trigger ConfirmDialog; click "Yes, delete"; await resolution | `getByText('Failed to delete recipe.')` is in the document; `mockNavigate` was NOT called |
| 23 | recipe not found (404) — shows error state with "← My Recipes" link | `getRecipeById` rejects with `{ response: { status: 404 } }`; await resolution | `getByText('Recipe not found.')` is in the document; `getByRole('link', { name: /← my recipes/i })` is in the document; `queryByRole('heading', { level: 1 })` is `null` (recipe title not shown) |
| 24 | invalid ObjectId in URL — error state shown | `getRecipeById` rejects (backend returns 500 for invalid ObjectId); `id` param = 'not-a-valid-id'; await resolution | `getByText('Recipe not found.')` is in the document |
| 25 | error state does not render Edit or Delete buttons | `getRecipeById` rejects | `queryByRole('link', { name: /edit/i })` is `null`; `queryByRole('button', { name: /delete/i })` is `null` |
| 26 | accessibility: page has a single h1 containing the recipe title | `getRecipeById` resolves with `fullRecipe` | `getAllByRole('heading', { level: 1 })` has length 1; its text content is `'Classic Pasta Carbonara'` |
| 27 | accessibility: Ingredients section has a heading | `getRecipeById` resolves with `fullRecipe` | `getByRole('heading', { name: /ingredients/i })` is in the document |
| 28 | accessibility: Instructions section has a heading | `getRecipeById` resolves with `fullRecipe` | `getByRole('heading', { name: /instructions/i })` is in the document |

---

## CreateRecipePage

**Test file:** `frontend/src/pages/__tests__/CreateRecipePage.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
```js
vi.mock('../../../api/recipesApi');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
// Mock RecipeForm to isolate page-level logic from form internals:
vi.mock('../../../components/RecipeForm', () => ({
  default: ({ onSubmit, submitLabel, initialData }) => {
    const [error, setError] = React.useState('');
    return (
      <form
        data-testid="recipe-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSubmit({ title: 'Test Recipe', ingredients: [], instructions: [] });
          } catch (err) {
            setError(err.response?.data?.message || 'Failed to save recipe.');
          }
        }}
      >
        {initialData && <input data-testid="initial-title" defaultValue={initialData.title} />}
        <button type="submit">{submitLabel}</button>
        {error && <p data-testid="form-error">{error}</p>}
      </form>
    );
  },
}));
```
**Router setup:**
```jsx
render(
  <MemoryRouter initialEntries={['/recipes/new']}>
    <Routes>
      <Route path="/recipes/new" element={<CreateRecipePage />} />
    </Routes>
  </MemoryRouter>
);
```

### Test cases

| # | Test name | Setup / preconditions | What to assert |
|---|-----------|----------------------|----------------|
| 1 | renders without crashing (smoke test) | default; no API calls needed | `getByRole('heading', { name: /new recipe/i })` is in the document; `getByTestId('recipe-form')` is in the document |
| 2 | "← My Recipes" back-link is rendered | default | `getByRole('link', { name: /← my recipes/i })` has `href` ending in `/recipes` |
| 3 | RecipeForm receives submitLabel="Create Recipe" | default | `getByRole('button', { name: /create recipe/i })` is in the document (mocked RecipeForm renders the label) |
| 4 | RecipeForm receives no initialData (create flow) | default | `queryByTestId('initial-title')` is `null` (no initialData passed to mocked RecipeForm) |
| 5 | successful submit calls createRecipe with form payload | `createRecipe` resolves with `{ ...fullRecipe, _id: 'new456' }`; `userEvent.click(getByRole('button', { name: /create recipe/i }))` | `recipesApi.createRecipe` was called with `{ title: 'Test Recipe', ingredients: [], instructions: [] }`; `mockNavigate` was called with `'/recipes'` |
| 6 | navigate('/recipes') called on successful create | `createRecipe` resolves; submit form | `mockNavigate` was called exactly 1 time with `'/recipes'` |
| 7 | createRecipe API failure — error shown in RecipeForm | `createRecipe` rejects with `{ response: { data: { message: 'Title is required' } } }`; submit form | `getByTestId('form-error')` contains text `'Title is required'`; `mockNavigate` was NOT called |
| 8 | createRecipe network error — RecipeForm shows fallback error | `createRecipe` rejects with `new Error('Network Error')`; submit form | `getByTestId('form-error')` contains text `'Failed to save recipe.'` |
| 9 | navigate is NOT called after failed submit | `createRecipe` rejects; submit form | `mockNavigate` was NOT called |
| 10 | page heading is "New Recipe" | default | `getByRole('heading', { name: 'New Recipe' })` is in the document (not 'Edit Recipe') |
| 11 | accessibility: page has a visible heading | default | `getByRole('heading', { level: 2, name: /new recipe/i })` is in the document |

---

## EditRecipePage

**Test file:** `frontend/src/pages/__tests__/EditRecipePage.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
```js
vi.mock('../../../api/recipesApi');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});
// Same RecipeForm mock as CreateRecipePage (shared helper or duplicate):
vi.mock('../../../components/RecipeForm', () => ({
  default: ({ onSubmit, submitLabel, initialData }) => {
    const [error, setError] = React.useState('');
    return (
      <form
        data-testid="recipe-form"
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSubmit({ title: 'Updated Title', ingredients: [], instructions: [] });
          } catch (err) {
            setError(err.response?.data?.message || 'Failed to save recipe.');
          }
        }}
      >
        {initialData && <input data-testid="initial-title" defaultValue={initialData.title} />}
        <button type="submit">{submitLabel}</button>
        {error && <p data-testid="form-error">{error}</p>}
      </form>
    );
  },
}));
```
**Router setup:**
```jsx
render(
  <MemoryRouter initialEntries={['/recipes/abc123/edit']}>
    <Routes>
      <Route path="/recipes/:id/edit" element={<EditRecipePage />} />
    </Routes>
  </MemoryRouter>
);
```

### Test cases

| # | Test name | Setup / preconditions | What to assert |
|---|-----------|----------------------|----------------|
| 1 | renders without crashing (smoke test) | `getRecipeById` resolves with `fullRecipe` | after `waitFor`: `getByRole('heading', { name: /edit recipe/i })` is in the document |
| 2 | shows loading state before data arrives | `getRecipeById` returns `new Promise(() => {})` | `getByText('Loading…')` is in the document immediately |
| 3 | loading indicator disappears after data loads | `getRecipeById` resolves with `fullRecipe` | after `waitForElementToBeRemoved(() => getByText('Loading…'))`: `queryByText('Loading…')` is `null` |
| 4 | getRecipeById is called with the URL param id | `getRecipeById` resolves with `fullRecipe`; param is 'abc123' | `recipesApi.getRecipeById` was called with `'abc123'` |
| 5 | RecipeForm receives initialData from API response | `getRecipeById` resolves with `fullRecipe` | after `waitFor`: `getByTestId('initial-title')` has `value` of `'Classic Pasta Carbonara'` |
| 6 | RecipeForm receives submitLabel="Update Recipe" | `getRecipeById` resolves with `fullRecipe` | after `waitFor`: `getByRole('button', { name: /update recipe/i })` is in the document |
| 7 | "← Back to Recipe" link points to /recipes/:id | `getRecipeById` resolves with `fullRecipe` | `getByRole('link', { name: /← back to recipe/i })` has `href` ending in `/recipes/abc123` |
| 8 | successful submit calls updateRecipe with correct id and payload | `getRecipeById` resolves with `fullRecipe`; `updateRecipe` resolves with `fullRecipe`; await data load; submit form | `recipesApi.updateRecipe` was called with `('abc123', { title: 'Updated Title', ingredients: [], instructions: [] })`; `mockNavigate` was called with `'/recipes/abc123'` |
| 9 | navigate('/recipes/:id') called on successful update | `updateRecipe` resolves; complete submit | `mockNavigate` was called exactly 1 time with `'/recipes/abc123'` |
| 10 | updateRecipe API failure — error shown in RecipeForm | `getRecipeById` resolves with `fullRecipe`; `updateRecipe` rejects with `{ response: { data: { message: 'Validation failed' } } }`; await load; submit form | `getByTestId('form-error')` contains text `'Validation failed'`; `mockNavigate` was NOT called |
| 11 | updateRecipe network error — RecipeForm shows fallback error | `getRecipeById` resolves with `fullRecipe`; `updateRecipe` rejects with `new Error('Network Error')`; submit | `getByTestId('form-error')` contains text `'Failed to save recipe.'` |
| 12 | getRecipeById failure on load — shows error state | `getRecipeById` rejects with `new Error('Not found')`; await resolution | `getByText('Recipe not found.')` is in the document; `queryByTestId('recipe-form')` is `null` |
| 13 | getRecipeById failure — RecipeForm is NOT rendered | `getRecipeById` rejects | after `waitFor`: `queryByTestId('recipe-form')` is `null`; `queryByRole('button', { name: /update recipe/i })` is `null` |
| 14 | error state renders without crashing (no back-link shown in error case) | `getRecipeById` rejects | `queryByRole('link', { name: /← back to recipe/i })` is `null` (error branch renders only the error paragraph) |
| 15 | navigate is NOT called after a failed getRecipeById | `getRecipeById` rejects | `mockNavigate` was NOT called |
| 16 | page heading is "Edit Recipe" not "New Recipe" | `getRecipeById` resolves with `fullRecipe` | after `waitFor`: `getByRole('heading', { name: 'Edit Recipe' })` is in the document; `queryByRole('heading', { name: /new recipe/i })` is `null` |
| 17 | page renders in loading state initially (no form visible yet) | `getRecipeById` returns slow promise | `queryByTestId('recipe-form')` is `null` during loading |
| 18 | accessibility: edit page heading is level 2 | `getRecipeById` resolves with `fullRecipe` | after `waitFor`: `getByRole('heading', { level: 2, name: /edit recipe/i })` is in the document |

---

## Appendix A — Render Helper

To avoid boilerplate, define a shared `renderWithRouter` helper per test file:

```jsx
// testUtils.jsx (shared across page tests)
import { render } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

export function renderPage(element, { path = '/', initialEntries = ['/'] } = {}) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <Routes>
        <Route path={path} element={element} />
      </Routes>
    </MemoryRouter>
  );
}
```

Usage for RecipeDetailPage:
```js
renderPage(<RecipeDetailPage />, {
  path: '/recipes/:id',
  initialEntries: ['/recipes/abc123'],
});
```

---

## Appendix B — Key Implementation Notes for the Coding Agent

1. **RecipesPage useSearchParams:** This page uses `useSearchParams` from react-router-dom. It does NOT use `useNavigate`. The mock for `useNavigate` is still included in global mocks to prevent errors in child components, but URL-driven behaviour is tested by providing `initialEntries` to MemoryRouter.

2. **RecipesPage sort is client-side only:** Changing sort/order params does NOT trigger a new API call. Tests #17 and #32 verify call counts stay at 1. The API is only re-called when `q` or `category` changes (the `useEffect` dependency array is `[q, category]`).

3. **RecipesPage cancellation guard:** The `useEffect` uses a `cancelled` flag to prevent state updates on unmounted components. Tests that unmount during a pending request should not produce act() warnings. Ensure all async effects are awaited in tests.

4. **ConfirmDialog is stateful:** After clicking "Delete", the component replaces the trigger button with the message + confirm/cancel buttons. There is no modal overlay — it renders inline. Tests must account for this two-phase state.

5. **EditRecipePage error vs loading branch order:** The component checks `error` before `!initialData`. If `getRecipeById` rejects, error is set and the error branch renders. If it is still pending, `!initialData` branch renders "Loading…". Tests #12 and #2 cover these distinct branches.

6. **RecipeForm mock strategy:** RecipeForm is mocked at the page level to isolate page behaviour from form internals. Dedicated RecipeForm unit tests (not covered in this document) should test the `toFormState`/`toPayload` conversions, dynamic ingredient/instruction rows, and per-field validation.

7. **useAuth mock scope:** LoginPage and RegisterPage call `useAuth()` to get `login`/`register`. These pages are tested without ProtectedRoute, so mocking `useAuth` directly is sufficient. RecipesPage, RecipeDetailPage, CreateRecipePage, and EditRecipePage are also tested without ProtectedRoute wrapping (render the page component directly), so `useAuth` does not need to be mocked for those tests unless NavBar is included in the render.

8. **API mock auto-reset:** `vi.resetAllMocks()` in `beforeEach` clears mock call history and implementations. Always re-establish mock return values inside each test or in a `beforeEach` within a `describe` block.

9. **Awaiting async state updates:** Use `await waitFor(() => expect(...).toBeInTheDocument())` for any assertion that depends on a resolved Promise. Use `waitForElementToBeRemoved` for loading-to-loaded transitions. Never assert on async state synchronously.

10. **`act()` warnings:** All `userEvent` calls in v14 are async. Use `await userEvent.click(...)` and `await userEvent.type(...)`. Wrap renders that immediately trigger `useEffect` API calls inside `await act(async () => { render(...); })` if RTL does not handle it automatically.
