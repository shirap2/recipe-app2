# Frontend Component Test Design

**Framework:** Vitest + React Testing Library + @testing-library/user-event
**Test environment:** jsdom (configured in `frontend/vite.config.js` under `test.environment`)
**Setup file:** `frontend/src/test/setup.js` (configure `@testing-library/jest-dom` matchers here)

---

## Global Mock Patterns

These patterns are reused throughout every test file. Establish them once per file at the top level.

### react-router-dom

Components that call `useNavigate` or render `<Link>` or `<Navigate>` must be wrapped in a router. Use `MemoryRouter` for unit tests so you control the initial URL without a real browser history.

```js
import { MemoryRouter } from 'react-router-dom';

// Wrap the component under test:
render(<MemoryRouter><ComponentUnderTest /></MemoryRouter>);

// To start at a specific path:
render(
  <MemoryRouter initialEntries={['/recipes/abc123']}>
    <ComponentUnderTest />
  </MemoryRouter>
);
```

### useAuth

`useAuth` is a hook that calls `useContext(AuthContext)`. Mock the entire module so tests never need a real `AuthProvider` (which would fire a real `refresh()` HTTP call on mount).

```js
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { id: '1', username: 'testuser' }, logout: vi.fn() }),
}));
```

Override per-test with `vi.mocked`:

```js
import useAuth from '../../hooks/useAuth';

// At top of describe block or in beforeEach:
vi.mock('../../hooks/useAuth');

// Per test:
vi.mocked(useAuth).mockReturnValue({ user: null, logout: vi.fn() });
vi.mocked(useAuth).mockReturnValue({ user: { id: '1', username: '' }, logout: vi.fn() });
```

### useToast

`useToast` throws if called outside `ToastProvider`. Mock the module to return a stable spy.

```js
const mockShowToast = vi.fn();
vi.mock('../../hooks/useToast', () => ({
  default: () => ({ showToast: mockShowToast }),
}));
```

### ToastProvider (for Toast / ToastContext integration tests)

`ToastProvider` does not require a router. Wrap directly:

```js
import { ToastProvider } from '../../context/ToastContext';

render(
  <ToastProvider>
    <ComponentUnderTest />
  </ToastProvider>
);
```

`useToast` throws if there is no `ToastContext`. When testing components that call `useToast` internally **without** mocking the hook module, wrap with `<ToastProvider>`. When mocking the hook module, the provider is not needed.

### Timer control (for Toast auto-dismiss)

```js
beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());
```

### userEvent setup (recommended pattern)

```js
import userEvent from '@testing-library/user-event';

const user = userEvent.setup(); // call once per test or in beforeEach
```

---

## NavBar

**Test file:** `frontend/src/components/__tests__/NavBar.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- `vi.mock('../../hooks/useAuth')` — controls `user` and `logout` per test
- Wrap every render in `<MemoryRouter>` (NavBar renders `<Link>` and calls `useNavigate`)
- `logout` mock must be `vi.fn()` — tests assert it was called and that navigation happened

```js
vi.mock('../../hooks/useAuth');
import useAuth from '../../hooks/useAuth';
```

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `useAuth` → `{ user: { id:'1', username:'testuser' }, logout: vi.fn() }` | `getByRole('navigation')` is in the document |
| 2 | renders brand link | same as #1 | `getByRole('link', { name: /recipe app/i })` is in the document and has `href="/recipes"` (via `to` prop resolved by MemoryRouter) |
| 3 | renders My Recipes link | same as #1 | `getByRole('link', { name: /my recipes/i })` is in the document |
| 4 | renders New Recipe link | same as #1 | `getByRole('link', { name: /\+ new recipe/i })` is in the document |
| 5 | renders username when user has username | `user: { id:'1', username:'alice' }` | `getByText('alice')` is in the document |
| 6 | renders "Account" fallback when username is empty string | `user: { id:'1', username:'' }` | `getByText('Account')` is in the document |
| 7 | renders "Account" fallback when user has no username field | `user: { id:'1' }` (no username key) | `getByText('Account')` is in the document |
| 8 | renders "Account" fallback when user is null | `user: null` | `getByText('Account')` is in the document and no crash occurs |
| 9 | logout button is present | same as #1 | `getByRole('button', { name: /logout/i })` is in the document |
| 10 | clicking logout calls logout() | `logout: vi.fn()` | after `user.click(getByRole('button', { name: /logout/i }))`, `logout` spy has been called once |
| 11 | clicking logout navigates to /login | use `MemoryRouter` with a spy on `useNavigate` via wrapping in a route that reads `location` | after clicking logout, confirm navigation to `/login` occurred (assert via `window.location` or a rendered `<Routes>` that shows a "login" sentinel element at `/login`) |
| 12 | logout called even if server returns error | `logout: vi.fn().mockRejectedValue(new Error('network'))` | no unhandled rejection thrown; component remains in the document after click (logout is `async` so await the user event) |
| 13 | nav is sticky / has correct landmark role | same as #1 | the element returned by `getByRole('navigation')` has `tagName === 'NAV'` |
| 14 | all links are keyboard accessible | same as #1 | `getByRole('link', { name: /my recipes/i })` can receive focus via `Tab` key; `document.activeElement` matches the element after tabbing to it |
| 15 | logout button is keyboard activatable | same as #1 | focus logout button, press `Enter`; `logout` spy is called |

---

## RecipeCard

**Test file:** `frontend/src/components/__tests__/RecipeCard.test.jsx`
**Tools:** Vitest, React Testing Library
**Mock setup:**
- Wrap every render in `<MemoryRouter>` (RecipeCard renders `<Link>`)
- No hooks to mock — component is pure/presentational

### Minimal valid recipe fixture

```js
const baseRecipe = {
  _id: 'abc123',
  title: 'Pasta Carbonara',
  difficulty: 'Easy',
  prepTime: 10,
  cookTime: 20,
  tags: ['italian', 'pasta'],
  ingredients: [{ name: 'eggs', amount: 2, unit: 'pcs' }],
};
```

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `recipe={baseRecipe}` | `getByRole('link')` is in the document |
| 2 | card is a link to the recipe detail page | `recipe={baseRecipe}` | `getByRole('link')` has `href` matching `/recipes/abc123` |
| 3 | renders recipe title | `recipe={baseRecipe}` | `getByText('Pasta Carbonara')` is in the document |
| 4 | renders difficulty badge | `recipe={baseRecipe}` | `getByText('Easy')` is in the document |
| 5 | renders prep and cook time | `recipe={baseRecipe}` (prepTime:10, cookTime:20) | `getByText(/prep 10m/i)` is in the document; `getByText(/cook 20m/i)` is in the document; `getByText(/30m total/i)` is in the document |
| 6 | renders total time when only prepTime is set | `recipe={{ ...baseRecipe, cookTime: 0 }}` | `getByText(/prep 10m/i)` is in the document; `getByText(/10m total/i)` is in the document; no "Cook" text present |
| 7 | renders total time when only cookTime is set | `recipe={{ ...baseRecipe, prepTime: 0, cookTime: 30 }}` | `getByText(/cook 30m/i)` in document; no "Prep" text; `getByText(/30m total/i)` in document |
| 8 | does not render time section when both are 0 | `recipe={{ ...baseRecipe, prepTime: 0, cookTime: 0 }}` | `queryByText(/total/i)` returns null |
| 9 | does not render time section when both are undefined | `recipe={{ ...baseRecipe, prepTime: undefined, cookTime: undefined }}` | `queryByText(/total/i)` returns null |
| 10 | renders up to 4 tags | `recipe={{ ...baseRecipe, tags: ['a','b','c','d','e'] }}` | exactly 4 tag spans rendered (use `getAllByText` on tags a–d); tag 'e' (`queryByText('e')`) returns null |
| 11 | renders ingredient count (plural) | `recipe={{ ...baseRecipe, ingredients: [{},{},{}] }}` | `getByText('3 ingredients')` is in the document |
| 12 | renders ingredient count (singular) | `recipe={{ ...baseRecipe, ingredients: [{}] }}` | `getByText('1 ingredient')` is in the document (no trailing 's') |
| 13 | does not render ingredient count when ingredients is empty | `recipe={{ ...baseRecipe, ingredients: [] }}` | `queryByText(/ingredient/)` returns null |
| 14 | does not render ingredient count when ingredients is undefined | `recipe={{ ...baseRecipe, ingredients: undefined }}` | `queryByText(/ingredient/)` returns null |
| 15 | does not render difficulty badge when difficulty is absent | `recipe={{ ...baseRecipe, difficulty: undefined }}` | no element with text matching `Easy|Medium|Hard` is present |
| 16 | does not render tags section when tags is empty array | `recipe={{ ...baseRecipe, tags: [] }}` | `queryByText('italian')` returns null |
| 17 | XSS safety: title with script tag renders as text | `recipe={{ ...baseRecipe, title: '<script>alert(1)</script>' }}` | `getByText('<script>alert(1)</script>')` is in the document (React escapes it); no `<script>` element exists in the container |
| 18 | XSS safety: tag with HTML entity renders as text | `recipe={{ ...baseRecipe, tags: ['<b>bold</b>'] }}` | `getByText('<b>bold</b>')` is in the document as literal text |
| 19 | very long title renders without overflow crash | `recipe={{ ...baseRecipe, title: 'A'.repeat(300) }}` | `getByRole('link')` is in the document and does not throw |
| 20 | unknown difficulty falls back to default badge style | `recipe={{ ...baseRecipe, difficulty: 'Expert' }}` | `getByText('Expert')` is in the document (rendered with fallback class, no crash) |

---

## RecipeForm

**Test file:** `frontend/src/components/__tests__/RecipeForm.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- No router needed (RecipeForm renders no `<Link>`)
- No auth mock needed
- `onSubmit` prop is always `vi.fn()` — may be sync or async depending on test

**Important:** `toFormState` and `toPayload` are not exported from `RecipeForm.jsx`. To unit-test them directly, they must first be exported. The test file should document this requirement. If they cannot be exported without modifying the source, test them indirectly through render + submit assertions. The table below marks direct unit tests with "(requires export)" and provides indirect equivalents.

### Pure function unit tests for toFormState (requires export)

| # | Test name | Input | Expected output |
|---|-----------|-------|-----------------|
| F1 | toFormState: null/undefined input returns defaults | `toFormState(undefined)` | `{ title:'', category:'Other', difficulty:'Medium', prepTime:'', cookTime:'', servings:'', tags:'', notes:'', ingredients:[{name:'',amount:'',unit:''}], instructions:[''] }` |
| F2 | toFormState: maps title | `toFormState({ title:'Pasta' })` | `result.title === 'Pasta'` |
| F3 | toFormState: maps category, falls back to 'Other' | `toFormState({})` | `result.category === 'Other'` |
| F4 | toFormState: maps difficulty, falls back to 'Medium' | `toFormState({})` | `result.difficulty === 'Medium'` |
| F5 | toFormState: converts tags array to comma string | `toFormState({ tags:['italian','pasta'] })` | `result.tags === 'italian, pasta'` |
| F6 | toFormState: empty tags array yields empty string | `toFormState({ tags:[] })` | `result.tags === ''` |
| F7 | toFormState: undefined tags yields empty string | `toFormState({ tags: undefined })` | `result.tags === ''` |
| F8 | toFormState: converts ingredient amount to string | `toFormState({ ingredients:[{ name:'eggs', amount:2, unit:'pcs' }] })` | `result.ingredients[0].amount === '2'` |
| F9 | toFormState: ingredient amount of 0 becomes string '0' | `toFormState({ ingredients:[{ name:'salt', amount:0, unit:'g' }] })` | `result.ingredients[0].amount === '0'` |
| F10 | toFormState: empty ingredients array yields one empty row | `toFormState({ ingredients:[] })` | `result.ingredients` has length 1 and equals `[{name:'',amount:'',unit:''}]` |
| F11 | toFormState: empty instructions array yields one empty string | `toFormState({ instructions:[] })` | `result.instructions` has length 1 and equals `['']` |
| F12 | toFormState: preserves prepTime 0 as 0 (not '') | `toFormState({ prepTime:0 })` | `result.prepTime === 0` |
| F13 | toFormState: undefined prepTime yields '' | `toFormState({})` | `result.prepTime === ''` |

### Pure function unit tests for toPayload (requires export)

| # | Test name | Input | Expected output |
|---|-----------|-------|-----------------|
| P1 | toPayload: trims title whitespace | `toPayload({ ...baseForm, title: '  Pasta  ' })` | `result.title === 'Pasta'` |
| P2 | toPayload: converts comma string to tags array | `toPayload({ ...baseForm, tags: 'italian, pasta, quick' })` | `result.tags` deep-equals `['italian','pasta','quick']` |
| P3 | toPayload: trims whitespace from individual tags | `toPayload({ ...baseForm, tags: '  soup , stew  ' })` | `result.tags` deep-equals `['soup','stew']` |
| P4 | toPayload: empty tags string yields empty array | `toPayload({ ...baseForm, tags: '' })` | `result.tags` deep-equals `[]` |
| P5 | toPayload: tags string with only commas yields empty array | `toPayload({ ...baseForm, tags: ' , , ' })` | `result.tags` deep-equals `[]` |
| P6 | toPayload: converts ingredient amount string to Number | `toPayload({ ...baseForm, ingredients:[{ name:'eggs', amount:'2', unit:'pcs' }] })` | `result.ingredients[0].amount === 2` (typeof number) |
| P7 | toPayload: ingredient amount '0' converts to Number 0 | `toPayload({ ...baseForm, ingredients:[{ name:'salt', amount:'0', unit:'g' }] })` | `result.ingredients[0].amount === 0` |
| P8 | toPayload: filters out ingredients with blank name | `toPayload({ ...baseForm, ingredients:[{ name:'  ', amount:'1', unit:'g' }, { name:'eggs', amount:'2', unit:'pcs' }] })` | `result.ingredients` has length 1 and `result.ingredients[0].name === 'eggs'` |
| P9 | toPayload: filters out blank instruction steps | `toPayload({ ...baseForm, instructions:['  ', 'Boil water', ''] })` | `result.instructions` deep-equals `['Boil water']` |
| P10 | toPayload: prepTime '' yields undefined | `toPayload({ ...baseForm, prepTime:'' })` | `result.prepTime === undefined` |
| P11 | toPayload: prepTime '15' converts to Number 15 | `toPayload({ ...baseForm, prepTime:'15' })` | `result.prepTime === 15` |
| P12 | toPayload: cookTime '' yields undefined | `toPayload({ ...baseForm, cookTime:'' })` | `result.cookTime === undefined` |
| P13 | toPayload: servings '' yields undefined | `toPayload({ ...baseForm, servings:'' })` | `result.servings === undefined` |
| P14 | toPayload: trims notes whitespace | `toPayload({ ...baseForm, notes:'  tip  ' })` | `result.notes === 'tip'` |
| P15 | toPayload: preserves category and difficulty | `toPayload({ ...baseForm, category:'Lunch', difficulty:'Hard' })` | `result.category === 'Lunch'`; `result.difficulty === 'Hard'` |

### baseForm fixture for toPayload tests

```js
const baseForm = {
  title: 'Test',
  category: 'Dinner',
  difficulty: 'Medium',
  prepTime: '10',
  cookTime: '20',
  servings: '4',
  tags: '',
  notes: '',
  ingredients: [{ name: 'eggs', amount: '2', unit: 'pcs' }],
  instructions: ['Crack eggs'],
};
```

### Rendered component test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| R1 | renders without crashing | `<RecipeForm onSubmit={vi.fn()} />` | `getByRole('form')` or `document.querySelector('form')` is in the document |
| R2 | renders title input | no initialData | `getByLabelText(/title/i)` is in the document |
| R3 | renders submit button with default label | `submitLabel` not provided | `getByRole('button', { name: /save recipe/i })` is in the document |
| R4 | renders submit button with custom label | `submitLabel="Create Recipe"` | `getByRole('button', { name: /create recipe/i })` is in the document |
| R5 | pre-populates fields from initialData | `initialData={{ title:'Pasta', category:'Lunch', difficulty:'Hard', tags:['italian'], notes:'tip' }}` | `getByLabelText(/title/i)` has value `'Pasta'`; category select has value `'Lunch'`; difficulty select has value `'Hard'`; tags input has value `'italian'`; notes textarea has value `'tip'` |
| R6 | pre-populates ingredient row from initialData | `initialData={{ ingredients:[{ name:'eggs', amount:2, unit:'pcs' }] }}` | first ingredient Name input has value `'eggs'`; Amount input has value `'2'`; Unit input has value `'pcs'` |
| R7 | renders one empty ingredient row when no initialData | no initialData | exactly one group of Name/Amount/Unit inputs rendered; all are empty |
| R8 | Add Ingredient button adds a new ingredient row | click `getByRole('button', { name: /\+ add ingredient/i })` | two sets of Name/Amount/Unit inputs are present after click |
| R9 | remove ingredient button hidden when only one row | no initialData (one ingredient row) | no remove button (`queryByRole('button', { name: /✕/ })`) visible in the ingredient section |
| R10 | remove ingredient button visible when 2+ rows | click Add Ingredient once | `getAllByRole('button', { name: /✕/ })` in ingredient section has length 2 |
| R11 | clicking remove ingredient removes that row | add two rows, remove first | only one ingredient row remains |
| R12 | Add Step button adds a new instruction textarea | click `getByRole('button', { name: /\+ add step/i })` | two instruction textareas are present after click |
| R13 | remove step hidden when only one step | no initialData | no remove step button visible for instructions |
| R14 | remove step button visible when 2+ steps | click Add Step once | remove buttons for instructions are present |
| R15 | submit calls onSubmit with correct payload | type `'Carbonara'` in title, keep defaults, click `getByRole('button', { name: /save recipe/i })` | `onSubmit` spy called once; first argument has `title === 'Carbonara'` |
| R16 | submit trims title whitespace in payload | type `'  Pasta  '` in title input | `onSubmit` called with `{ title: 'Pasta', ... }` |
| R17 | submit with whitespace-only title does not call onSubmit | clear title, type `'   '` | `onSubmit` is NOT called (browser `required` + `minLength=3` prevents submission); OR if called, `toPayload` yields `title:''` — assert HTML5 validation prevents submit via `getByLabelText(/title/i)` having `validity.valid === false` |
| R18 | submit shows loading state | `onSubmit` returns a Promise that never resolves (`new Promise(() => {})`) | immediately after click, `getByRole('button', { name: /saving…/i })` is in the document and has `disabled` attribute |
| R19 | submit button re-enables after successful submit | `onSubmit` returns resolved Promise | after `await` the submit, button shows `save recipe` text and is not disabled |
| R20 | error message shown on submit failure | `onSubmit: vi.fn().mockRejectedValue({ response: { data: { message: 'Title already taken.' } } })` | after submit resolves, `getByText('Title already taken.')` is in the document |
| R21 | generic error shown when no response message | `onSubmit: vi.fn().mockRejectedValue(new Error('network'))` | `getByText('Failed to save recipe.')` is in the document |
| R22 | error message cleared on next submit attempt | submit once to produce error, then submit again | after second submit, previous error text is no longer visible while request is in flight |
| R23 | category select contains all expected options | no initialData | `getAllByRole('option')` on the category select includes 'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other' |
| R24 | difficulty select defaults to Medium | no initialData | difficulty `<select>` has current value `'Medium'` |
| R25 | XSS safety: title input value with script tag is not executed | type `'<script>alert(1)</script>'` in title input | `getByDisplayValue('<script>alert(1)</script>')` is present (treated as text); no `<script>` child elements injected in the DOM |
| R26 | accessibility: title input has accessible label | no initialData | `getByLabelText(/title \*/i)` returns the title input (label is associated) |
| R27 | accessibility: category select has accessible label | no initialData | `getByLabelText(/category/i)` returns the select element |
| R28 | accessibility: difficulty select has accessible label | no initialData | `getByLabelText(/difficulty/i)` returns the select element |
| R29 | accessibility: tags input has accessible label | no initialData | `getByLabelText(/tags/i)` returns the input |
| R30 | accessibility: notes textarea has accessible label | no initialData | `getByLabelText(/notes/i)` returns the textarea |

---

## SearchBar

**Test file:** `frontend/src/components/__tests__/SearchBar.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- No router, no auth, no toast mocks needed
- `onSearch` and `onClear` props are always `vi.fn()`

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `onSearch={vi.fn()} onClear={vi.fn()}` | `getByRole('searchbox')` is in the document |
| 2 | input has accessible aria-label | default props | `getByRole('searchbox', { name: /search recipes/i })` is in the document |
| 3 | renders Search button | default props | `getByRole('button', { name: /search/i })` is in the document |
| 4 | Clear button absent when isSearching is false | `isSearching={false}` (default) | `queryByRole('button', { name: /clear/i })` returns null |
| 5 | Clear button present when isSearching is true | `isSearching={true}` | `getByRole('button', { name: /clear/i })` is in the document |
| 6 | renders with custom placeholder | `placeholder="Find a dish..."` | `getByPlaceholderText('Find a dish...')` is in the document |
| 7 | pre-populates input from initialValue | `initialValue="pasta"` | `getByRole('searchbox')` has value `'pasta'` |
| 8 | typing updates input value | type `'chicken'` into the searchbox | `getByRole('searchbox')` has value `'chicken'` |
| 9 | submitting with non-empty value calls onSearch with trimmed query | type `'  pasta  '`, click Search | `onSearch` spy called once with argument `'pasta'`; `onClear` not called |
| 10 | submitting with empty value calls onClear | leave input empty, click Search | `onClear` spy called once; `onSearch` not called |
| 11 | submitting with whitespace-only value calls onClear | type `'   '`, click Search | `onClear` spy called once; `onSearch` not called |
| 12 | clicking Clear button calls onClear and clears input | `isSearching={true}`, type `'pasta'`, click Clear | `onClear` spy called once; `getByRole('searchbox')` has value `''` |
| 13 | submitting via Enter key calls onSearch | type `'soup'`, press `Enter` | `onSearch` spy called once with `'soup'` |
| 14 | onSearch called with exact trimmed value (no double-trim) | type `'chicken soup'`, click Search | `onSearch` called with `'chicken soup'` (internal spaces preserved) |
| 15 | accessibility: search input is of type "search" | default props | `getByRole('searchbox')` has `type="search"` attribute |
| 16 | accessibility: Search button is keyboard activatable | focus the Search button, press Space | `onSearch` or `onClear` is called (depends on input value) |

---

## CategoryFilter

**Test file:** `frontend/src/components/__tests__/CategoryFilter.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- No router, no auth, no toast mocks needed
- `onChange` prop is always `vi.fn()`

### Expected categories (in order)

`['Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other']`

Plus the "All" button = 8 buttons total.

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `value={null} onChange={vi.fn()}` | component root element is in the document |
| 2 | renders a button for every category plus "All" | `value={null} onChange={vi.fn()}` | `getAllByRole('button')` has length 8 |
| 3 | renders All, Breakfast, Lunch, Dinner, Snack, Dessert, Drink, Other buttons | default props | each of those labels found via `getByRole('button', { name: /^All$/i })` etc. |
| 4 | group has accessible label | default props | `getByRole('group', { name: /filter by category/i })` is in the document |
| 5 | "All" button has aria-pressed="true" when value is null | `value={null}` | `getByRole('button', { name: /^all$/i })` has `aria-pressed="true"` |
| 6 | "All" button has aria-pressed="false" when a category is selected | `value="Lunch"` | `getByRole('button', { name: /^all$/i })` has `aria-pressed="false"` |
| 7 | selected category button has aria-pressed="true" | `value="Dinner"` | `getByRole('button', { name: /^dinner$/i })` has `aria-pressed="true"` |
| 8 | unselected category buttons have aria-pressed="false" | `value="Dinner"` | `getByRole('button', { name: /^lunch$/i })` has `aria-pressed="false"` |
| 9 | clicking an unselected category calls onChange with that category | `value={null}`, click Breakfast button | `onChange` spy called once with argument `'Breakfast'` |
| 10 | clicking the currently selected category calls onChange with null (deselect) | `value="Breakfast"`, click Breakfast button | `onChange` spy called once with argument `null` |
| 11 | clicking "All" button calls onChange with null | `value="Lunch"`, click All button | `onChange` spy called once with argument `null` |
| 12 | clicking a different category when one is already selected calls onChange with new category | `value="Lunch"`, click Dinner | `onChange` spy called once with `'Dinner'` |
| 13 | accessibility: each button is keyboard activatable | focus Breakfast button, press Enter | `onChange` spy called with `'Breakfast'` |
| 14 | accessibility: buttons have correct role | default props | all 8 elements returned by `getAllByRole('button')` have `type="button"` attribute |

---

## SortControls

**Test file:** `frontend/src/components/__tests__/SortControls.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- No router, no auth, no toast mocks needed
- `onChange` prop is always `vi.fn()`

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `sort="createdAt" order="desc" onChange={vi.fn()}` | both `getByLabelText(/sort by/i)` and `getByLabelText(/sort order/i)` are in the document |
| 2 | "Sort by" select is labelled | default props | `getByRole('combobox', { name: /sort by/i })` is in the document |
| 3 | "Sort order" select is labelled | default props | `getByRole('combobox', { name: /sort order/i })` is in the document |
| 4 | "Sort by" select reflects sort prop | `sort="title"` | `getByLabelText(/sort by/i)` has value `'title'` |
| 5 | "Sort order" select reflects order prop | `order="asc"` | `getByLabelText(/sort order/i)` has value `'asc'` |
| 6 | "Sort by" defaults to "createdAt" when prop omitted | no `sort` prop | `getByLabelText(/sort by/i)` has value `'createdAt'` |
| 7 | "Sort order" defaults to "desc" when prop omitted | no `order` prop | `getByLabelText(/sort order/i)` has value `'desc'` |
| 8 | "Sort by" select has all 4 options | default props | `getAllByRole('option', { hidden: true })` on the sort-by select includes 'Date added', 'Title', 'Prep time', 'Cook time' |
| 9 | "Sort order" select has 2 options | default props | options on sort-order select include 'Newest first' and 'Oldest first' |
| 10 | changing sort field calls onChange with new field and current order | `sort="createdAt" order="desc"`, change sort-by select to 'title' | `onChange` spy called once with `('title', 'desc')` |
| 11 | changing sort order calls onChange with current field and new order | `sort="title" order="desc"`, change order select to 'asc' | `onChange` spy called once with `('title', 'asc')` |
| 12 | accessibility: selects are keyboard-navigable | focus `getByLabelText(/sort by/i)`, press ArrowDown | focus remains on select and value changes |

---

## ConfirmDialog

**Test file:** `frontend/src/components/__tests__/ConfirmDialog.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- No router, no auth, no toast mocks needed
- `onConfirm` prop is always `vi.fn()`

### States

- **Idle state:** only the trigger button is rendered
- **Pending state:** message text + confirm button + cancel button are rendered; trigger button is gone

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `message="Delete?" onConfirm={vi.fn()} triggerLabel="Delete"` | `getByRole('button', { name: /delete/i })` is in the document |
| 2 | initial state shows only trigger button | same as #1 | `getByRole('button', { name: /delete/i })` is in the document; `queryByText('Delete?')` returns null; `queryByRole('button', { name: /yes, delete/i })` returns null |
| 3 | clicking trigger shows message and confirm/cancel buttons | click the trigger button | `getByText('Delete?')` is in the document; `getByRole('button', { name: /yes, delete/i })` is in the document; `getByRole('button', { name: /cancel/i })` is in the document |
| 4 | trigger button disappears after click | click trigger | `queryByRole('button', { name: /delete/i })` that was the trigger returns null (the "Yes, delete" confirm button is different) |
| 5 | clicking confirm calls onConfirm | click trigger, then click `getByRole('button', { name: /yes, delete/i })` | `onConfirm` spy called once |
| 6 | clicking confirm closes the dialog (returns to idle state) | `onConfirm: vi.fn()` (sync), click trigger then confirm | after confirm, `queryByText('Delete?')` returns null; `getByRole('button', { name: /delete/i })` (trigger) is back in the document |
| 7 | clicking cancel closes the dialog | click trigger, then click `getByRole('button', { name: /cancel/i })` | `getByRole('button', { name: /delete/i })` (trigger) is back; `queryByText('Delete?')` returns null |
| 8 | clicking cancel does NOT call onConfirm | click trigger, click cancel | `onConfirm` spy has call count 0 |
| 9 | custom triggerLabel is rendered | `triggerLabel="Remove Item"` | `getByRole('button', { name: /remove item/i })` is in the document |
| 10 | custom confirmLabel is rendered | `confirmLabel="Yes, remove" triggerLabel="Remove"`, click trigger | `getByRole('button', { name: /yes, remove/i })` is in the document |
| 11 | custom cancelLabel is rendered | `cancelLabel="No, keep it" triggerLabel="Delete"`, click trigger | `getByRole('button', { name: /no, keep it/i })` is in the document |
| 12 | trigger uses custom triggerClassName | `triggerClassName="my-custom-class" triggerLabel="Delete"` | `getByRole('button', { name: /delete/i })` has class `my-custom-class` |
| 13 | trigger uses default class "btn-danger" when no triggerClassName | `triggerLabel="Delete"` (no triggerClassName) | `getByRole('button', { name: /delete/i })` has class `btn-danger` |
| 14 | onConfirm returning a rejected Promise does not crash | `onConfirm: vi.fn().mockRejectedValue(new Error('fail'))`, click trigger then confirm | no unhandled rejection thrown; component does not unmount or throw |
| 15 | Escape key closes dialog (if implemented) | This component has NO Escape-key handler in the current implementation | verify: `queryByRole('button', { name: /yes, delete/i })` is still visible after pressing Escape — document that Escape is NOT handled and file a note to add it in a future iteration |
| 16 | clicking outside dialog does NOT close it | click trigger, then `fireEvent.click(document.body)` | `getByText('Delete?')` is still in the document (no outside-click dismissal implemented) |
| 17 | message with long text renders without overflow crash | `message={'A'.repeat(300)} triggerLabel="Delete"`, click trigger | `getByText('A'.repeat(300))` is in the document |
| 18 | accessibility: confirm and cancel buttons have type="button" | click trigger | `getByRole('button', { name: /yes, delete/i })` has `type="button"`; `getByRole('button', { name: /cancel/i })` has `type="button"` (prevents accidental form submission) |
| 19 | accessibility: keyboard — trigger activatable via Enter | focus trigger button, press Enter | pending state appears (`getByText('Delete?')` in document) |
| 20 | accessibility: keyboard — confirm activatable via Enter | click trigger, focus confirm button, press Enter | `onConfirm` spy is called |
| 21 | accessibility: keyboard — cancel activatable via Enter | click trigger, focus cancel button, press Enter | dialog returns to idle state |

---

## Toast

**Test file:** `frontend/src/components/__tests__/Toast.test.jsx`
**Tools:** Vitest, React Testing Library, @testing-library/user-event
**Mock setup:**
- No router, no auth mocks needed
- `onDismiss` prop is always `vi.fn()`
- Use `vi.useFakeTimers()` / `vi.useRealTimers()` to control auto-dismiss timer

### Toast fixture shape

```js
const successToast = { id: 'toast-1', message: 'Recipe saved!', variant: 'success', duration: 4000 };
const errorToast   = { id: 'toast-2', message: 'Something went wrong.', variant: 'error', duration: 4000 };
const persistToast = { id: 'toast-3', message: 'Persistent.', variant: 'success', duration: 0 };
```

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing | `toast={successToast} onDismiss={vi.fn()}` | `getByRole('alert')` is in the document |
| 2 | renders toast message | `toast={successToast}` | `getByText('Recipe saved!')` is in the document |
| 3 | success variant renders success icon text | `toast={successToast}` | element with text `✓` is in the document (within the toast) |
| 4 | error variant renders error icon text | `toast={errorToast}` | element with text `✕` is in the document (within the toast) |
| 5 | dismiss button is present | `toast={successToast}` | `getByRole('button', { name: /dismiss notification/i })` is in the document |
| 6 | clicking dismiss button calls onDismiss with toast id | `toast={successToast}, onDismiss: vi.fn()` | after clicking the dismiss button, `onDismiss` spy called once with argument `'toast-1'` |
| 7 | auto-dismiss fires after duration ms | `toast={successToast}` (duration:4000), `onDismiss: vi.fn()`, fake timers | before `vi.advanceTimersByTime(3999)`: `onDismiss` not called; after `vi.advanceTimersByTime(1)` more: `onDismiss` called once with `'toast-1'` |
| 8 | auto-dismiss does NOT fire when duration is 0 | `toast={persistToast}` (duration:0), fake timers | after `vi.advanceTimersByTime(99999)`, `onDismiss` not called |
| 9 | timer is cleared on unmount (no setState after unmount) | render, then `unmount()` before timer fires, advance timers | no error thrown; `onDismiss` not called after unmount |
| 10 | role="alert" for screen reader announcement | default | `getByRole('alert')` is in the document |
| 11 | dismiss button icon aria-hidden | default | the `×` span has `aria-label="Dismiss notification"` on the button, not the span; the icon `✓`/`✕` span has `aria-hidden="true"` |
| 12 | long message renders without crash | `toast={{ ...successToast, message: 'A'.repeat(500) }}` | `getByRole('alert')` is in the document |
| 13 | XSS safety: message with HTML is rendered as text | `toast={{ ...successToast, message: '<img src=x onerror=alert(1)>' }}` | `getByText('<img src=x onerror=alert(1)>')` is in the document as text; no `<img>` element exists inside the alert |

### ToastContext / ToastProvider integration tests

These tests belong in a separate file: `frontend/src/context/__tests__/ToastContext.test.jsx`

| # | Test name | Setup | What to assert |
|---|-----------|-------|----------------|
| I1 | showToast renders a Toast into the notification region | render a child component that calls `useToast().showToast('Hello', 'success')` inside ToastProvider | `getByRole('region', { name: /notifications/i })` is in the document; after triggering showToast, `getByText('Hello')` is visible |
| I2 | multiple rapid showToast calls stack toasts | call `showToast` three times in quick succession | `getAllByRole('alert')` has length 3 |
| I3 | dismissing a toast removes it from the DOM | render a toast, click its dismiss button | `queryByText` for that toast's message returns null |
| I4 | useToast throws when used outside ToastProvider | render a component that calls `useToast()` without wrapping in ToastProvider | rendering throws an error matching `'useToast must be used inside ToastProvider'` (use `expect(() => render(...)).toThrow(...)`) |
| I5 | auto-dismiss removes toast from DOM | `duration: 100`, fake timers, advance past 100ms | `queryByRole('alert')` returns null after timer fires |

---

## ProtectedRoute

**Test file:** `frontend/src/components/__tests__/ProtectedRoute.test.jsx`
**Tools:** Vitest, React Testing Library
**Mock setup:**
- `vi.mock('../../hooks/useAuth')` — controls `user` per test
- `vi.mock('./NavBar', () => ({ default: () => <nav data-testid="mock-navbar" /> }))` — prevents NavBar from needing its own useAuth/router deps; this isolates ProtectedRoute behavior
- Wrap every render in `<MemoryRouter>` (ProtectedRoute renders `<Navigate>` or `<NavBar>` which contains `<Link>`)

**Key architectural note:** `AuthContext` renders `{!loading && children}`, meaning `ProtectedRoute` is never mounted while `loading` is true. Therefore there is no "loading" visual state to test in ProtectedRoute itself — document this explicitly as a comment in the test file.

```js
// NOTE: AuthContext renders children only after loading is false ({!loading && children}).
// ProtectedRoute is never mounted in a loading state. No loading test is needed here.
```

### Test cases

| # | Test name | Setup / props | What to assert |
|---|-----------|---------------|----------------|
| 1 | renders without crashing when user is logged in | `useAuth` → `{ user: { id:'1', username:'testuser' } }` | no error thrown |
| 2 | renders NavBar when user is present | `user: { id:'1', username:'testuser' }` | `getByTestId('mock-navbar')` is in the document |
| 3 | renders children when user is present | `user: { id:'1', username:'testuser' }`, `children: <div data-testid="child">content</div>` | `getByTestId('child')` is in the document |
| 4 | children are rendered inside a `<main>` element | same as #3 | `getByRole('main')` is in the document and contains `getByTestId('child')` |
| 5 | redirects to /login when user is null | `user: null`, render inside `<MemoryRouter initialEntries={['/recipes']}>` with a `<Routes>` that maps `/login` to a sentinel `<div data-testid="login-page" />` | `getByTestId('login-page')` is in the document; `getByTestId('mock-navbar')` is not |
| 6 | does NOT render children when user is null | `user: null` | `queryByTestId('child')` returns null |
| 7 | does NOT render NavBar when user is null | `user: null` | `queryByTestId('mock-navbar')` returns null |
| 8 | redirect uses `replace` (no history entry pushed) | `user: null`, use a `MemoryRouter` and check `history` entries after render | the history length has not increased (user can't press Back to get to the protected page) — verify via `MemoryRouter`'s router object or by asserting `<Navigate replace>` is rendered |
| 9 | renders correctly with user whose username is empty string | `user: { id:'1', username:'' }` | `getByTestId('mock-navbar')` is in the document; `getByTestId('child')` is in the document |
| 10 | renders correctly with minimal user object | `user: { id:'1' }` (no username, no other fields) | `getByTestId('mock-navbar')` is in the document; no crash |

---

## Setup File Reference

**File:** `frontend/src/test/setup.js`

This file is referenced in `vite.config.js` as `test.setupFiles`. It must exist and should contain at minimum:

```js
import '@testing-library/jest-dom';
```

This enables matchers like `toBeInTheDocument()`, `toHaveValue()`, `toBeDisabled()`, `toHaveAttribute()`, and `toHaveClass()` used throughout the tests above.

---

## Dependency Checklist

All of the following must be present in `frontend/package.json` under `devDependencies` before tests can run:

| Package | Purpose |
|---------|---------|
| `vitest` | Test runner (already configured in vite.config.js) |
| `@testing-library/react` | `render`, `screen`, `fireEvent` |
| `@testing-library/user-event` | Realistic user interactions (type, click, keyboard) |
| `@testing-library/jest-dom` | Extended matchers (toBeInTheDocument, etc.) |
| `jsdom` | DOM environment for Vitest |

---

## Notes on Current Implementation

1. **`toFormState` and `toPayload` are not exported.** To enable the pure-function unit tests marked "(requires export)", add `export` to both function declarations in `RecipeForm.jsx`:
   ```js
   export function toFormState(data) { ... }
   export function toPayload(form) { ... }
   ```
   If the source cannot be modified, test these functions indirectly through the rendered component tests (R5, R15, R16, R20).

2. **ConfirmDialog has no Escape key or outside-click dismissal.** Tests #15 and #16 document the current behavior (nothing happens) so regressions are caught if the feature is added later.

3. **AuthContext renders `{!loading && children}`.** ProtectedRoute is never rendered during the loading phase. There is intentionally no loading-state test for ProtectedRoute.

4. **NavBar renders the emoji "🍳".** The brand link test uses `{ name: /recipe app/i }` which matches on accessible text and tolerates the emoji prefix. If emoji rendering in jsdom is inconsistent, use `getByRole('link', { name: /🍳 Recipe App/i })` or match on `href` instead.

5. **RecipeForm labels are not associated with inputs via `htmlFor`/`id`.** Tests R26–R30 use `getByLabelText` — these will fail if the labels are not properly associated. If association is missing, this is a real accessibility defect and should be fixed in the source. As a workaround, use `getByPlaceholderText` or `getByRole` with a name matcher, and file a bug.
