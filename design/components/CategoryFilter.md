# CategoryFilter

## Purpose
A horizontal pill group rendered above the recipe grid in `RecipesPage` that lets the user filter their recipes by category.

---

## Files
- CREATE `frontend/src/components/CategoryFilter.jsx`
- MODIFY `frontend/src/pages/RecipesPage.jsx` — add `CategoryFilter` below the search bar, wire `?category=` URL param
- MODIFY `backend/models/Recipe.js` — add `category` enum field (Breakfast | Lunch | Dinner | Snack | Dessert | Drink | Other, default: 'Other') **[Backend prerequisite]**
- MODIFY `backend/controllers/recipeController.js` — filter `getAllRecipes` by `req.query.category` when present **[Backend prerequisite]**
- MODIFY `frontend/src/index.css` — add `.filter-pill` and `.filter-pill-active` to `@layer components`

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `value` | `string \| null` | Yes | — | The currently selected category. `null` means "All" (no filter). |
| `onChange` | `(category: string \| null) => void` | Yes | — | Called with the new category string when a pill is clicked, or `null` when "All" is clicked. |

`CategoryFilter` is a fully controlled component. It holds no state. `RecipesPage` owns the active category value and persists it in the `?category=` URL param.

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| Nothing | — | No React hooks, no router, no API calls |

`CategoryFilter` is a pure presentational component — it renders pills from a static list and fires `onChange`. All state and side-effects live in `RecipesPage`.

---

## Signatures & Data Types

### Component

```js
/**
 * Horizontal pill group for filtering recipes by category.
 * Controlled component — parent owns the selected value.
 *
 * @param {CategoryFilterProps} props
 * @returns {JSX.Element}
 */
export default function CategoryFilter(props: CategoryFilterProps): JSX.Element
```

### Props type

```ts
type CategoryFilterProps = {
  value:    string | null;                       // null = "All" selected
  onChange: (category: string | null) => void;   // null signals "clear filter"
}
```

### Constant: category list

```ts
/**
 * Ordered list of all valid recipe categories.
 * Must match the enum in backend/models/Recipe.js exactly.
 */
const CATEGORIES: string[] = [
  'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other'
];
```

The "All" entry is not in this array — it is hard-coded as the first pill with `value={null}`.

### Data types produced

None. `CategoryFilter` calls `onChange` as a side effect and renders nothing to external state.

---

## States

### 1. No filter active (`value === null`)
The "All" pill is styled with `.filter-pill-active`. All category pills use `.filter-pill` (inactive style).

```
[All]  [Breakfast]  [Lunch]  [Dinner]  [Snack]  [Dessert]  [Drink]  [Other]
```

### 2. Category selected (`value === 'Dinner'`, for example)
The matching category pill is styled with `.filter-pill-active`. All other pills (including "All") use `.filter-pill`.

```
[All]  [Breakfast]  [Lunch]  [Dinner]  [Snack]  [Dessert]  [Drink]  [Other]
```

**No checkmark character is rendered.** Active state is conveyed visually via `.filter-pill-active` styling (dark sage background) and to assistive technology via `aria-pressed="true"`. Do not add a `✓` or any other character to the pill label — the label text is always just the category name.

There is no loading or error state — `CategoryFilter` is purely visual. Error and loading states are handled by `RecipesPage`.

---

## Behavior

| Interaction | Action |
|-------------|--------|
| Click "All" | `onChange(null)` |
| Click a category pill (not currently active) | `onChange('Breakfast')` (or whichever was clicked) |
| Click the currently active category pill | `onChange(null)` — acts as a toggle to clear the filter |
| Click "All" when "All" is already active | `onChange(null)` — no-op in practice (parent re-sets same value) |

**Toggle behavior:** Clicking an already-active category de-selects it (calls `onChange(null)`). This lets the user dismiss the filter without having to click "All".

---

## Layout

```
┌───────────────────────────────────────────────────────┐
│  [All]  [Breakfast]  [Lunch]  [Dinner]  [Snack]  ...  │
└───────────────────────────────────────────────────────┘
```

- Flex row, `flex-wrap` (pills wrap to a second line on narrow viewports)
- `gap-2` between pills
- `mb-6` below the row to separate from the recipe grid
- Pills are `<button type="button">` elements — never `<a>` tags (no navigation occurs)
- The "All" pill is always first

---

## Integration: `RecipesPage.jsx`

`RecipesPage` is responsible for reading/writing the `?category=` URL param and passing the value down to `CategoryFilter`.

**URL param convention:** `?category=Dinner` for a selected category; param absent (not `?category=`) when no filter is active.

**Wiring pattern:**

```jsx
import { useSearchParams } from 'react-router-dom';
import CategoryFilter from '../components/CategoryFilter';

// Inside RecipesPage:
const [searchParams, setSearchParams] = useSearchParams();
const activeCategory = searchParams.get('category'); // string | null

const handleCategoryChange = (category) => {
  setSearchParams(prev => {
    const next = new URLSearchParams(prev);
    if (category) {
      next.set('category', category);
    } else {
      next.delete('category');
    }
    return next;
  });
};

// In JSX, below the search bar:
<CategoryFilter value={activeCategory} onChange={handleCategoryChange} />
```

`RecipesPage` must re-fetch recipes when `activeCategory` changes (add it to the `useEffect` dependency array and pass it to `getAllRecipes`).

**Note:** The backend `GET /api/recipes?category=` endpoint must be implemented before this filtering produces real results. Until then, `CategoryFilter` can be rendered and `RecipesPage` can pass the param to `getAllRecipes`, but the backend will ignore it — which is an acceptable intermediate state.

---

## Design tokens used

Two new component classes must be added to `frontend/src/index.css` inside `@layer components`:

```css
/* Filter pill — inactive state */
.filter-pill {
  @apply inline-flex items-center justify-center font-medium text-sm px-4 py-1.5 rounded-full cursor-pointer transition-colors duration-150 bg-cream-100 hover:bg-cream-200 text-sage-600 border border-cream-300;
}

/* Filter pill — active state */
.filter-pill-active {
  @apply inline-flex items-center justify-center font-medium text-sm px-4 py-1.5 rounded-full cursor-pointer transition-colors duration-150 bg-sage-600 text-cream-50 border border-sage-600;
}
```

`rounded-full` (fully rounded) distinguishes filter pills visually from action buttons (which use `rounded` at 4px). This is intentional — pills communicate "filter toggle", buttons communicate "action".

| Element | Classes |
|---------|---------|
| Pill row wrapper | `flex flex-wrap gap-2 mb-6` |
| Inactive pill | `.filter-pill` |
| Active pill | `.filter-pill-active` |

No new colors. Both classes use only existing theme tokens (`sage`, `cream`).

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Pill row wrapper | `role="group"` + `aria-label="Filter by category"` |
| Each `<button>` | `type="button"` to prevent form submission |
| Active pill | `aria-pressed="true"` — communicates toggle state to screen readers |
| Inactive pill | `aria-pressed="false"` |
| "All" pill | `aria-pressed={value === null}` |

Using `aria-pressed` is correct here because pills behave as toggle buttons, not radio buttons. A `role="radiogroup"` pattern would also be valid but is more complex to implement and provides no practical benefit for this use case.

---

## Related bugs / features

### Feature: Category and sorting (system_design.md §10.3)
`CategoryFilter` is one part of this feature. The full scope is:
1. Add `category` field to Recipe schema (backend)
2. Extend `GET /api/recipes` to accept `?category=` (backend)
3. **`CategoryFilter` component** ← this file
4. `SortControls` component (separate design file)
5. Persist filters in URL params (done via `useSearchParams` in `RecipesPage`)

`CategoryFilter` can be merged independently from `SortControls`. The two components do not depend on each other.

---

## Test cases

File: `frontend/src/components/__tests__/CategoryFilter.test.jsx`

No mocks required. `CategoryFilter` has no external dependencies.
No `MemoryRouter` wrapper needed — this component has no router dependency.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Renders "All" pill | `getByRole('button', { name: 'All' })` present |
| 3 | Renders all 7 category pills | One button for each of: Breakfast, Lunch, Dinner, Snack, Dessert, Drink, Other |
| 4 | "All" pill is active when `value` is null | "All" button has `aria-pressed="true"`, all others have `aria-pressed="false"` |
| 5 | Correct pill is active when `value` is set | `value="Dinner"` → Dinner button has `aria-pressed="true"`, all others false |
| 6 | Clicking inactive category calls `onChange` with that category | Click "Breakfast" → `onChange` called with `'Breakfast'` |
| 7 | Clicking "All" calls `onChange(null)` | Click "All" → `onChange` called with `null` |
| 8 | Clicking the active category calls `onChange(null)` (toggle off) | `value="Dinner"`, click "Dinner" → `onChange` called with `null` |
| 9 | Each pill has `type="button"` | No pill button has `type="submit"` |
| 10 | Pill group has accessible label | `getByRole('group', { name: 'Filter by category' })` resolves |
| 11 | Active pill has `aria-pressed="true"` | Asserted for each category value |
