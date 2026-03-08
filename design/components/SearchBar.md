# SearchBar

## Purpose
Controlled search input with Submit and Clear buttons — extracted from `RecipesPage`. Drives the `?q=` URL query param so search state survives navigation.

---

## Files
- CREATE `frontend/src/components/SearchBar.jsx`
- MODIFY `frontend/src/pages/RecipesPage.jsx` — replace inline search `<form>` with `<SearchBar>`, move search-driven data fetching to respond to `?q=` URL param (fixes BUG-004)

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `onSearch` | `(query: string) => void` | Yes | — | Called when the form is submitted with a non-empty trimmed query. Receives the trimmed query string. |
| `onClear` | `() => void` | Yes | — | Called when the Clear button is clicked or when the form is submitted with an empty value. |
| `initialValue` | `string` | No | `''` | Populates the input on first render. Used by `RecipesPage` to sync the input with the `?q=` URL param on mount / navigation. |
| `placeholder` | `string` | No | `'Search by title or tag…'` | Input placeholder text. |
| `isSearching` | `boolean` | No | `false` | When `true`, the Clear button is shown. Controlled by the parent — SearchBar does not decide whether a search is active. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `useState` | `react` | Manages the controlled input value |

No router, no API calls, no context. SearchBar is a pure UI component — all data fetching stays in `RecipesPage`.

---

## Signatures & Data Types

### Component

```js
/**
 * Search input form. Calls onSearch(trimmedQuery) on submit,
 * calls onClear() on clear or empty submit.
 * Does not fetch data or read the URL — the parent owns those concerns.
 *
 * @param {SearchBarProps} props
 * @returns {JSX.Element}
 */
export default function SearchBar(props: SearchBarProps): JSX.Element
```

### Props type

```ts
type SearchBarProps = {
  onSearch:      (query: string) => void;
  onClear:       () => void;
  initialValue?: string;     // default: ''
  placeholder?:  string;     // default: 'Search by title or tag…'
  isSearching?:  boolean;    // default: false
}
```

### Internal state

```ts
/**
 * Current value of the text input. Initialised from props.initialValue.
 * Cleared when onClear fires.
 */
const [value, setValue] = useState<string>(initialValue ?? '');
```

### Internal functions

```js
/**
 * Form submit handler.
 * If value.trim() is non-empty: calls props.onSearch(value.trim()).
 * If value.trim() is empty: calls props.onClear() (treats empty submit as a clear).
 * @param {React.FormEvent<HTMLFormElement>} e
 * @returns {void}
 */
function handleSubmit(e): void

/**
 * Clear button click handler.
 * Resets internal value to '' and calls props.onClear().
 * @returns {void}
 */
function handleClear(): void
```

### Data types produced

SearchBar produces no data. It calls `onSearch` or `onClear` as side effects. It owns only the transient input text — it never owns the query that is in effect.

---

## States

### 1. Idle (no active search, `isSearching = false`)
- Input field visible with placeholder
- Submit ("Search") button visible
- Clear button **not** visible

```
[Search by title or tag…          ] [Search]
```

### 2. Active search (`isSearching = true`)
- Input shows the current query
- Submit ("Search") button visible (user can refine the query)
- Clear button **visible** to the right of Search

```
[pasta                             ] [Search]  [Clear]
```

### 3. Focused input (no special rendering)
- Input shows `:focus` ring via `.input` class
- No other visual change

---

## Behavior

| Trigger | Action |
|---------|--------|
| Type in input | Updates internal `value` state |
| Submit form with non-empty value | Calls `onSearch(value.trim())` |
| Submit form with empty value | Calls `onClear()`, does not call `onSearch` |
| Click "Clear" | Resets `value` to `''`, calls `onClear()` |
| `initialValue` prop changes | Does **not** re-sync — `initialValue` is read once on mount. Parent must remount or use a `key` prop if re-sync is needed. **Do not add a `useEffect` to sync `initialValue` to internal state** — this is intentional read-once behaviour. |

**Note:** SearchBar does not modify the URL. `RecipesPage` is responsible for writing `?q=` to the URL in response to `onSearch` / `onClear` callbacks (BUG-004 fix).

---

## Layout

### Idle state
```
┌──────────────────────────────────────┬──────────┐
│  Search by title or tag…             │  Search  │
└──────────────────────────────────────┴──────────┘
```

### Active search state
```
┌──────────────────────────────────────┬──────────┬─────────┐
│  pasta                               │  Search  │  Clear  │
└──────────────────────────────────────┴──────────┴─────────┘
```

- Flex row, `gap-2`, `mb-8` (applied by the parent wrapper, not SearchBar itself)
- Input is `max-w-sm` to prevent it from stretching full-width on large screens
- Buttons sit inline to the right of the input

---

## Integration: replacing the inline form in `RecipesPage.jsx`

### BUG-004 fix — persist query in `?q=` URL param

`RecipesPage` must be updated alongside SearchBar extraction so that the active search query lives in the URL, not in component state. This ensures the browser back button works and the list state is recoverable after navigation.

**Before (current `RecipesPage` — search in local state):**
```jsx
const [search, setSearch]       = useState('');
const [searching, setSearching] = useState(false);

const handleSearch = async (e) => {
  e.preventDefault();
  if (!search.trim()) { setSearching(false); return load(); }
  setSearching(true);
  // ...fetch searchRecipes(search.trim())
};

const handleClear = () => { setSearch(''); setSearching(false); load(); };

<form onSubmit={handleSearch} className="flex gap-2 mb-8">
  <input className="input max-w-sm" value={search} onChange={...} placeholder="..." />
  <button type="submit" className="btn-secondary">Search</button>
  {searching && <button type="button" onClick={handleClear} className="btn-ghost">Clear</button>}
</form>
```

**After (RecipesPage with SearchBar + URL param):**
```jsx
import { useSearchParams } from 'react-router-dom';
import SearchBar from '../components/SearchBar';

const [searchParams, setSearchParams] = useSearchParams();
const q = searchParams.get('q') ?? '';

// useEffect reads `q` from the URL and fetches accordingly:
useEffect(() => {
  if (q) {
    // fetch searchRecipes(q)
  } else {
    // fetch getAllRecipes()
  }
}, [q]);

const handleSearch = (query) => setSearchParams({ q: query });
const handleClear  = ()      => setSearchParams({});

<div className="flex gap-2 mb-8">
  <SearchBar
    onSearch={handleSearch}
    onClear={handleClear}
    initialValue={q}
    isSearching={!!q}
  />
</div>
```

The `searching` local state boolean is removed — `!!q` (URL param is non-empty) replaces it.

---

## Design tokens used

| Element | Classes |
|---------|---------|
| `<form>` wrapper | `flex gap-2` (SearchBar renders the form; parent adds `mb-8`) |
| Text input | `.input max-w-sm` |
| Submit button | `.btn-secondary` |
| Clear button | `.btn-ghost` |

No new colors. No inline styles. No new component classes needed.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| `<input>` | `type="search"` — semantic type; browsers may render a native clear button (acceptable) |
| `<input>` | `aria-label="Search recipes"` — no visible `<label>` is present, so `aria-label` is required |
| Submit button | `type="submit"`, visible text "Search" — no additional `aria-label` needed |
| Clear button | `type="button"`, visible text "Clear" — no additional `aria-label` needed |

---

## Related bugs

### BUG-004 — Search not persisted in URL
**Where:** `RecipesPage.jsx`

SearchBar extraction is the right time to fix BUG-004. The fix requires changing `RecipesPage` to read/write `?q=` via `useSearchParams`, then passing the URL-driven values into SearchBar's props. SearchBar itself has no awareness of the URL — the fix lives entirely in `RecipesPage`.

---

## Test cases

File: `frontend/src/components/__tests__/SearchBar.test.jsx`

No mocks required. SearchBar has no external dependencies.
Wrap renders in `<MemoryRouter>` is not needed — this component has no router dependency.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Input shows `initialValue` on mount | `getByRole('searchbox')` has value matching `initialValue` |
| 3 | Input shows placeholder when empty | Placeholder text is visible |
| 4 | Clear button hidden when `isSearching = false` | `queryByRole('button', { name: 'Clear' })` is null |
| 5 | Clear button visible when `isSearching = true` | `getByRole('button', { name: 'Clear' })` is present |
| 6 | Typing updates the input value | After `userEvent.type`, input value reflects typed text |
| 7 | Submit with non-empty value calls `onSearch` with trimmed query | `onSearch` mock called with `'pasta'` when user types `'  pasta  '` and submits |
| 8 | Submit with empty value calls `onClear`, not `onSearch` | `onClear` called once; `onSearch` not called |
| 9 | Clicking Clear calls `onClear` and resets input to `''` | `onClear` called once; input value is `''` after click |
| 10 | Clicking Clear does not call `onSearch` | `onSearch` mock not called after Clear click |
| 11 | Input is accessible | `getByRole('searchbox', { ... })` or `getByLabelText('Search recipes')` resolves |
| 12 | Submit button is accessible | `getByRole('button', { name: 'Search' })` resolves |
