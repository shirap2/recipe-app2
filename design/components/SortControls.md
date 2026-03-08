# SortControls

## Purpose
Dropdown pair that lets the user sort the recipe list by a chosen field and direction — renders two `<select>` elements (sort field + sort order) and notifies the parent on any change.

---

## Files
- CREATE `frontend/src/components/SortControls.jsx`
- MODIFY `frontend/src/pages/RecipesPage.jsx` — add `<SortControls>` below `<SearchBar>`, persist `?sort=` and `?order=` in the URL alongside `?q=` (consistent with BUG-004 fix approach)

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `sort` | `'title' \| 'prepTime' \| 'cookTime' \| 'createdAt'` | No | `'createdAt'` | Currently active sort field. Controlled by the parent via URL param. |
| `order` | `'asc' \| 'desc'` | No | `'desc'` | Currently active sort direction. Controlled by the parent via URL param. |
| `onChange` | `(sort: SortField, order: SortOrder) => void` | Yes | — | Called whenever either select changes. Receives the updated `sort` and `order` values. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| *(none)* | — | Pure UI component — no hooks, no router, no API calls |

SortControls is fully controlled: it owns no state. The parent (`RecipesPage`) owns `sort` and `order` via URL params and passes them as props.

---

## Signatures & Data Types

### Component

```js
/**
 * Controlled sort field + sort order dropdowns.
 * Calls onChange(sort, order) whenever either select changes.
 * Owns no internal state — the parent controls the active values via props.
 *
 * @param {SortControlsProps} props
 * @returns {JSX.Element}
 */
export default function SortControls(props: SortControlsProps): JSX.Element
```

### Props type

```ts
type SortField = 'title' | 'prepTime' | 'cookTime' | 'createdAt';
type SortOrder = 'asc' | 'desc';

type SortControlsProps = {
  sort?:     SortField;  // default: 'createdAt'
  order?:    SortOrder;  // default: 'desc'
  onChange:  (sort: SortField, order: SortOrder) => void;
}
```

### Sort field options

| Value | Display label |
|-------|---------------|
| `createdAt` | Date added |
| `title` | Title |
| `prepTime` | Prep time |
| `cookTime` | Cook time |

### Sort order options

| Value | Display label |
|-------|---------------|
| `desc` | Newest first / Z→A / Longest first |
| `asc` | Oldest first / A→Z / Shortest first |

The order labels are generic ("Newest first" / "Oldest first") to keep the UI consistent regardless of which field is active.

### Internal functions

```js
/**
 * Field select onChange handler.
 * Calls props.onChange(newField, props.order).
 * `props.order` is used directly — SortControls has no internal state,
 * so there is no local "currentOrder" variable; always read from props.
 * @param {React.ChangeEvent<HTMLSelectElement>} e
 * @returns {void}
 */
function handleFieldChange(e): void

/**
 * Order select onChange handler.
 * Calls props.onChange(props.sort, newOrder).
 * `props.sort` is used directly — SortControls has no internal state,
 * so there is no local "currentSort" variable; always read from props.
 * @param {React.ChangeEvent<HTMLSelectElement>} e
 * @returns {void}
 */
function handleOrderChange(e): void
```

### Data types produced

SortControls produces no data. It calls `onChange(sort, order)` as a side effect when either select changes.

---

## States

### 1. Default / no active sort

Both selects show their defaults: "Date added" and "Newest first".

```
Sort by [Date added ▾]  [Newest first ▾]
```

### 2. Active sort

Selects reflect the controlled `sort` and `order` prop values.

```
Sort by [Title       ▾]  [A→Z          ▾]
```

There is no loading state, error state, or empty state. SortControls is always rendered identically regardless of how many recipes are in the list.

---

## Behavior

| Trigger | Action |
|---------|--------|
| User changes the field select | `handleFieldChange` → `onChange(newField, currentOrder)` |
| User changes the order select | `handleOrderChange` → `onChange(currentSort, newOrder)` |
| `sort` or `order` prop changes | Selects re-render to reflect new values — no internal state to sync |

**Important:** SortControls does not fetch data or write URL params. `RecipesPage` is responsible for writing `?sort=` and `?order=` to the URL in response to `onChange`, and for re-fetching the recipe list.

---

## Layout

```
┌────────────┬───────────────────┐  ┌──────────────────┐
│ Sort by    │  Date added    ▾  │  │  Newest first  ▾ │
└────────────┴───────────────────┘  └──────────────────┘
```

- Flex row, `items-center`, `gap-2`
- "Sort by" label sits inline to the left of the first select
- Both selects are the same width (`w-36`)
- The entire SortControls component renders inline — `RecipesPage` controls outer spacing (e.g. `mb-8`)

---

## Integration: adding SortControls to `RecipesPage.jsx`

**After (RecipesPage with SearchBar + SortControls + URL params):**

```jsx
import { useSearchParams } from 'react-router-dom';
import SearchBar    from '../components/SearchBar';
import SortControls from '../components/SortControls';

const [searchParams, setSearchParams] = useSearchParams();
const q        = searchParams.get('q')        ?? '';
const sort     = searchParams.get('sort')     ?? 'createdAt';
const order    = searchParams.get('order')    ?? 'desc';
const category = searchParams.get('category') ?? null;

// useEffect reads q, sort, order from URL and fetches accordingly
useEffect(() => {
  // pass sort + order to getAllRecipes (once the backend supports it)
  // or sort client-side in the interim (see note below)
}, [q, sort, order, category]);

/**
 * All three handlers use the functional form of setSearchParams and
 * mutate a copy of the existing params. This preserves params owned
 * by sibling components (e.g. CategoryFilter's ?category=, SearchBar's ?q=).
 * Never call setSearchParams({ key: value }) directly — that discards
 * all other active params.
 */
const handleSearch = (query) =>
  setSearchParams(prev => { const p = new URLSearchParams(prev); p.set('q', query); return p; });

const handleClear = () =>
  setSearchParams(prev => { const p = new URLSearchParams(prev); p.delete('q'); return p; });

const handleSortChange = (newSort, newOrder) =>
  setSearchParams(prev => {
    const p = new URLSearchParams(prev);
    p.set('sort', newSort);
    p.set('order', newOrder);
    return p;
  });

<div className="flex flex-wrap gap-2 mb-8">
  <SearchBar
    onSearch={handleSearch}
    onClear={handleClear}
    initialValue={q}
    isSearching={!!q}
  />
  <SortControls
    sort={sort}
    order={order}
    onChange={handleSortChange}
  />
</div>
```

> **Note for CategoryFilter integration:** The `handleCategoryChange` function in `CategoryFilter.md` already follows this same `prev => new URLSearchParams(prev)` pattern. All three handlers in `RecipesPage` must use this pattern so that `?q=`, `?sort=`, `?order=`, and `?category=` coexist without clobbering each other.

### Client-side sort (interim, until backend supports `?sort=&order=`)

Until `GET /api/recipes` accepts `?sort=&order=` (see Section 10.3 in `system_design.md`), `RecipesPage` should sort the fetched array client-side before passing it to the grid:

```js
const sorted = [...recipes].sort((a, b) => {
  const aVal = a[sort] ?? '';
  const bVal = b[sort] ?? '';
  if (typeof aVal === 'string') {
    return order === 'asc'
      ? aVal.localeCompare(bVal)
      : bVal.localeCompare(aVal);
  }
  return order === 'asc' ? aVal - bVal : bVal - aVal;
});
```

Once the backend query param support is added, the client-side sort should be removed and the params forwarded to the API instead.

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Wrapper | `flex items-center gap-2` |
| "Sort by" label | `text-sm text-sage-600 whitespace-nowrap` |
| Field `<select>` | `input w-36` |
| Order `<select>` | `input w-36` |

The `.input` class from `index.css` covers border, background, focus ring, and text styling. No new component classes are needed.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Field `<select>` | `aria-label="Sort by"` — no visible `<label>` with `htmlFor` in this layout; `aria-label` is required |
| Order `<select>` | `aria-label="Sort order"` — same reasoning |
| "Sort by" text | Rendered as `<span>` (decorative, not a `<label>`) — purely visual; the selects carry their own labels via `aria-label` |

---

## Related features

### Feature 10.3 — Category and sorting (post-MVP backend)

The backend currently does not accept `?sort=&order=` on `GET /api/recipes`. Until that is implemented, `RecipesPage` sorts the result array client-side (see integration note above). Once 10.3 is shipped:

1. Pass `sort` and `order` as query params to `getAllRecipes` and `searchRecipes`
2. Remove the client-side sort from `RecipesPage`
3. No changes needed in `SortControls` itself — its API is stable

---

## Test cases

File: `frontend/src/components/__tests__/SortControls.test.jsx`

No mocks required. SortControls has no external dependencies.
`<MemoryRouter>` wrapper is not needed — this component has no router dependency.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Field select defaults to "Date added" when `sort` prop is omitted | Field select value is `'createdAt'` |
| 3 | Order select defaults to "Newest first" when `order` prop is omitted | Order select value is `'desc'` |
| 4 | Field select reflects controlled `sort` prop | When `sort="title"`, field select shows "Title" |
| 5 | Order select reflects controlled `order` prop | When `order="asc"`, order select shows "Oldest first" |
| 6 | Changing field select calls `onChange` with new field and current order | `onChange` mock called with `('title', 'desc')` when field changes to `'title'` |
| 7 | Changing order select calls `onChange` with current sort and new order | `onChange` mock called with `('createdAt', 'asc')` when order changes to `'asc'` |
| 8 | Changing either select does not change the other | After field change, order value in `onChange` call matches the prop that was passed in |
| 9 | Field select is accessible | `getByRole('combobox', { name: 'Sort by' })` resolves |
| 10 | Order select is accessible | `getByRole('combobox', { name: 'Sort order' })` resolves |
| 11 | All four field options are rendered | `title`, `prepTime`, `cookTime`, `createdAt` all present as `<option>` elements |
| 12 | Both order options are rendered | `asc` and `desc` both present as `<option>` elements |
