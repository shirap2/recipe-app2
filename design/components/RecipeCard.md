# RecipeCard

## Purpose
Summary card for a single recipe — renders title, difficulty badge, time metadata, tags, and ingredient count as a clickable link to the recipe detail page.

---

## Files
- No changes needed — component is correctly implemented.
- This design file exists to document the contract for agents working on components that render RecipeCard (e.g. RecipesPage, SearchBar integration).

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `recipe` | `RecipeCardData` | Yes | — | Recipe object from the API. Only a subset of fields are used — see data types. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `Link` | `react-router-dom` | Entire card is a link to `/recipes/:id` |

No hooks, no API calls, no context. RecipeCard is a pure presentational component.

---

## Signatures & Data Types

### Component

```js
/**
 * Clickable summary card for a single recipe.
 * The entire card is wrapped in a <Link> to /recipes/:id.
 * Renders title, optional difficulty badge, optional time row,
 * up to 4 tags, and ingredient count.
 *
 * @param {{ recipe: RecipeCardData }} props
 * @returns {JSX.Element}
 */
export default function RecipeCard({ recipe }): JSX.Element
```

### Props type

```ts
/**
 * The subset of recipe fields that RecipeCard reads.
 * The full Recipe object from the API contains additional fields
 * (instructions, notes, source, etc.) that RecipeCard ignores.
 */
type RecipeCardData = {
  _id:          string;           // MongoDB ObjectId as string — used in the link href
  title:        string;           // Displayed as the card heading
  difficulty?:  'Easy' | 'Medium' | 'Hard';  // Optional — badge hidden if absent
  prepTime?:    number;           // Minutes — optional; time row hidden if both are 0/absent
  cookTime?:    number;           // Minutes — optional
  tags?:        string[];         // Optional — tag row hidden if empty; max 4 shown
  ingredients?: { name: string; amount: number; unit: string }[];
                                  // Optional — count shown if length > 0
}
```

### Internal constant

```ts
/**
 * Maps difficulty value to Tailwind classes for the badge.
 * Falls back to a neutral style for any unrecognised value.
 */
const DIFFICULTY_STYLES: Record<string, string> = {
  Easy:   'bg-sage-100 text-sage-700',
  Medium: 'bg-cream-200 text-terracotta-600',
  Hard:   'bg-terracotta-100 text-terracotta-700',
};
// Fallback (unrecognised difficulty): 'bg-cream-100 text-sage-600'
```

### Derived value

```ts
/**
 * Sum of prepTime and cookTime. Computed inline — not a function.
 * The time row is hidden when totalTime === 0.
 */
const totalTime: number = (recipe.prepTime || 0) + (recipe.cookTime || 0);
```

### Data types produced

None. RecipeCard renders JSX and produces no callbacks or external state.

---

## States

### 1. Full data
Title, difficulty badge, time row (prep · cook · total), tags (up to 4), ingredient count all visible.

```
┌──────────────────────────────────────────┐
│  Pasta Carbonara                   [Easy]│
│  Prep 15m · Cook 20m · 35m total        │
│  [italian] [pasta] [quick] [dinner]      │
│  6 ingredients                           │
└──────────────────────────────────────────┘
```

### 2. Minimal data (title only)
Only the title is rendered. All optional rows are hidden. This is valid — title is the only required field.

```
┌──────────────────────────────────────────┐
│  Pasta Carbonara                         │
└──────────────────────────────────────────┘
```

### 3. Partial time (only prepTime or only cookTime)
Time row is shown but only the present field appears. `·` separators are only rendered between two present values.

```
Prep 15m · 15m total        ← cookTime absent
Cook 20m · 20m total        ← prepTime absent
```

### 4. More than 4 tags
Only the first 4 tags are rendered (`tags.slice(0, 4)`). Remaining tags are silently truncated — no "more" indicator.

---

## Behavior

| Interaction | Result |
|-------------|--------|
| Click anywhere on the card | Navigate to `/recipes/${recipe._id}` |
| Hover | Card lifts slightly (`-translate-y-0.5`), shadow deepens (`shadow-md`), title text transitions to terracotta |

The card is a `<Link>` — keyboard users can tab to it and activate it with Enter. No additional click handlers exist.

---

## Layout

```
┌─────────────────────────────────────────────────┐  ← .card (white, border, rounded-lg, shadow-sm)
│                                                 │     + hover:shadow-md hover:-translate-y-0.5
│  [Title text]                    [Diff badge]   │  ← flex justify-between items-start gap-3 mb-2
│                                                 │
│  Prep Xm · Cook Ym · Zm total                  │  ← hidden when totalTime === 0
│                                                 │
│  [tag1] [tag2] [tag3] [tag4]                    │  ← hidden when tags empty; max 4
│                                                 │
│  N ingredients                                  │  ← hidden when ingredients empty
│                                                 │
└─────────────────────────────────────────────────┘
```

The entire card is a `<Link>` (`display: block`). Internal elements are not individually linked.

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Card wrapper `<Link>` | `card block no-underline p-5 hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 group` |
| Title `<h3>` | `text-sage-900 font-semibold text-base leading-snug group-hover:text-terracotta-600 transition-colors m-0` |
| Difficulty badge `<span>` | `text-xs font-bold px-2 py-0.5 rounded whitespace-nowrap` + `DIFFICULTY_STYLES[difficulty]` |
| Difficulty badge fallback | `bg-cream-100 text-sage-600` |
| Time row `<p>` | `text-sage-500 text-xs mt-1 mb-0` |
| Tag `<span>` | `bg-cream-100 text-sage-600 text-xs px-2 py-0.5 rounded` |
| Tag row wrapper | `flex flex-wrap gap-1.5 mt-3` |
| Ingredient count `<p>` | `text-sage-400 text-xs mt-2 mb-0` |

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| `<Link>` (card root) | Contains visible title text — screen readers announce the title as the link label |
| Difficulty badge | Inside the link — announced as part of the link text; no `aria-label` needed |
| Tags | Inside the link — announced as part of the link text |

No interactive elements are nested inside the `<Link>` — the card is a single focusable element. No additional ARIA attributes are needed.

---

## Usage in `RecipesPage`

```jsx
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {recipes.map(r => <RecipeCard key={r._id} recipe={r} />)}
</div>
```

`key` must be `r._id` (not array index) so React reconciles cards correctly when the list order changes (e.g. after sorting).

---

## Test cases

File: `frontend/src/components/__tests__/RecipeCard.test.jsx`

Mock setup required:
```js
// No mocks needed — RecipeCard has no external dependencies beyond react-router-dom
```
Wrap all renders in `<MemoryRouter>`.

Minimal recipe fixture:
```js
const recipe = {
  _id: 'abc123',
  title: 'Pasta Carbonara',
  difficulty: 'Easy',
  prepTime: 15,
  cookTime: 20,
  tags: ['italian', 'pasta', 'quick', 'dinner', 'extra'],
  ingredients: [
    { name: 'egg', amount: 2, unit: 'pcs' },
    { name: 'pasta', amount: 200, unit: 'g' },
  ],
};
```

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Renders the recipe title | `getByText('Pasta Carbonara')` is present |
| 3 | Card links to the recipe detail page | The root element has `href="/recipes/abc123"` |
| 4 | Renders difficulty badge | `getByText('Easy')` is present |
| 5 | Applies correct badge style for Easy | Badge element has `bg-sage-100` class |
| 6 | Applies correct badge style for Hard | Badge element has `bg-terracotta-100` class |
| 7 | Renders total time when both prepTime and cookTime are set | `getByText(/35m total/)` is present |
| 8 | Renders only prepTime when cookTime is absent | Time text contains `Prep 15m` but not `Cook` |
| 9 | Hides time row when neither prepTime nor cookTime is set | No element with `/total/` text |
| 10 | Renders up to 4 tags | 4 tag spans present; the 5th tag `'extra'` is not rendered |
| 11 | Hides tag row when tags is empty or absent | No tag spans when `recipe.tags = []` |
| 12 | Renders ingredient count | `getByText('2 ingredients')` is present |
| 13 | Renders singular "ingredient" for count of 1 | `getByText('1 ingredient')` (no "s") |
| 14 | Hides ingredient count when ingredients is empty or absent | No ingredient count text when `recipe.ingredients = []` |
| 15 | Card is accessible as a link | `getByRole('link', { name: /Pasta Carbonara/ })` resolves |
| 16 | Renders correctly with title only (all optional fields absent) | No crash; only title visible |
