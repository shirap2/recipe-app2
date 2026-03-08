# RecipeForm

## Purpose
Shared create/edit form for a recipe — used by both `CreateRecipePage` and `EditRecipePage`. Manages dynamic ingredient rows and instruction steps, converts between API data shapes and internal form state, and delegates submission to the parent page.

---

## Files
- MODIFY `frontend/src/components/RecipeForm.jsx` — add `category` field to form state, payload, and JSX

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `initialData` | `RecipeData \| undefined` | No | `undefined` | Pre-populated data for edit mode. `undefined` for create mode — form initialises to empty defaults. |
| `onSubmit` | `(payload: RecipePayload) => Promise<void>` | Yes | — | Called with the API-ready payload on form submit. The parent handles the API call and navigation. Errors thrown by `onSubmit` are caught and displayed inline. |
| `submitLabel` | `string` | No | `'Save Recipe'` | Label on the submit button. Pass `'Create Recipe'` or `'Save Changes'` from the parent. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `useState` | `react` | Form state, error state, loading state |

No router, no API calls, no context. RecipeForm is purely a form — the parent owns submission and navigation.

---

## Signatures & Data Types

### Component

```js
/**
 * Shared create/edit recipe form.
 * Converts between API RecipeData shape and internal flat form state
 * via toFormState() and toPayload(). The parent provides onSubmit()
 * which receives the API-ready payload.
 *
 * @param {RecipeFormProps} props
 * @returns {JSX.Element}
 */
export default function RecipeForm({ initialData, onSubmit, submitLabel }): JSX.Element
```

### Props type

```ts
type RecipeFormProps = {
  initialData?:  RecipeData;                          // undefined → create mode
  onSubmit:      (payload: RecipePayload) => Promise<void>;
  submitLabel?:  string;                              // default: 'Save Recipe'
}
```

### Internal form state

```ts
/**
 * Flat internal state that mirrors the form fields directly.
 * All numeric fields are stored as strings so controlled inputs work correctly
 * (number inputs must have string values in React).
 * Tags are stored as a comma-separated string; split to array in toPayload().
 */
type FormState = {
  title:        string;
  category:     'Breakfast' | 'Lunch' | 'Dinner' | 'Snack' | 'Dessert' | 'Drink' | 'Other';
  difficulty:   'Easy' | 'Medium' | 'Hard';
  prepTime:     string;   // number as string, or '' if not set
  cookTime:     string;   // number as string, or '' if not set
  servings:     string;   // number as string, or '' if not set
  tags:         string;   // comma-separated, e.g. "italian, pasta, quick"
  notes:        string;
  ingredients:  IngredientRow[];
  instructions: string[];
}

type IngredientRow = {
  name:   string;
  amount: string;  // stored as string for controlled input; converted to Number in toPayload
  unit:   string;
}
```

### `toFormState` — API data → form state

```js
/**
 * Converts a RecipeData object (from the API) into the flat FormState
 * shape used by the form inputs. Safe to call with undefined (create mode).
 *
 * Conversions:
 * - ingredients[].amount: Number → String (for controlled number inputs)
 * - tags: string[] → comma-joined string (e.g. ['italian','pasta'] → 'italian, pasta')
 * - category: defaults to 'Other' if absent
 * - difficulty: defaults to 'Medium' if absent
 * - ingredients: defaults to [EMPTY_INGREDIENT] if absent or empty
 * - instructions: defaults to [''] if absent or empty
 * - numeric fields: defaults to '' if absent (not 0)
 *
 * @param {RecipeData | undefined} data
 * @returns {FormState}
 */
function toFormState(data: RecipeData | undefined): FormState
```

### `toPayload` — form state → API payload

```js
/**
 * Converts the internal FormState into a RecipePayload ready for the API.
 *
 * Conversions:
 * - title: trimmed
 * - ingredients: filtered to rows where name.trim() is non-empty;
 *                amount converted from string to Number
 * - instructions: filtered to steps where trim() is non-empty
 * - tags: split on ',', each trimmed, empty strings removed
 * - prepTime / cookTime / servings: '' → undefined; non-empty → Number
 * - notes: trimmed
 * - category: passed through as-is (always a valid enum value)
 * - difficulty: passed through as-is
 *
 * @param {FormState} form
 * @returns {RecipePayload}
 */
function toPayload(form: FormState): RecipePayload
```

### `RecipeData` — shape received from the API

```ts
/**
 * The full recipe object returned by GET /api/recipes/:id.
 * RecipeForm only reads a subset of these fields.
 */
type RecipeData = {
  _id:          string;
  title:        string;
  category?:    string;
  difficulty?:  string;
  prepTime?:    number;
  cookTime?:    number;
  servings?:    number;
  tags?:        string[];
  notes?:       string;
  ingredients?: { name: string; amount: number; unit: string }[];
  instructions?: string[];
}
```

### `RecipePayload` — shape sent to the API

```ts
/**
 * The request body for POST /api/recipes and PATCH /api/recipes/:id.
 * All fields are optional for PATCH; all required for POST except notes.
 */
type RecipePayload = {
  title:        string;
  category:     string;
  difficulty:   string;
  prepTime?:    number;
  cookTime?:    number;
  servings?:    number;
  tags:         string[];
  notes:        string;
  ingredients:  { name: string; amount: number; unit: string }[];
  instructions: string[];
}
```

### Internal constants

```ts
const EMPTY_INGREDIENT: IngredientRow = { name: '', amount: '', unit: '' };

/**
 * Must exactly match the category enum in backend/models/Recipe.js
 * and the CATEGORIES constant in CategoryFilter.jsx.
 */
const CATEGORIES: string[] = [
  'Breakfast', 'Lunch', 'Dinner', 'Snack', 'Dessert', 'Drink', 'Other'
];
```

### Internal state

```ts
const [form, setForm]       = useState<FormState>(() => toFormState(initialData));
const [error, setError]     = useState<string>('');
const [loading, setLoading] = useState<boolean>(false);
```

### Internal functions

```js
/**
 * Generic field setter. Updates a single top-level field in form state.
 * @param {keyof FormState} field
 * @param {any} value
 * @returns {void}
 */
const set = (field, value): void

/**
 * Updates a single field in a single ingredient row.
 * @param {number} i      — row index
 * @param {string} field  — 'name' | 'amount' | 'unit'
 * @param {string} value
 * @returns {void}
 */
const setIngredient = (i, field, value): void

/** Appends a blank ingredient row. @returns {void} */
const addIngredient = (): void

/**
 * Removes ingredient row at index i.
 * Only callable when ingredients.length > 1 (enforced in JSX).
 * @param {number} i
 * @returns {void}
 */
const removeIngredient = (i): void

/** Updates instruction step at index i. @returns {void} */
const setInstruction = (i, value): void

/** Appends a blank instruction step. @returns {void} */
const addInstruction = (): void

/**
 * Removes instruction step at index i.
 * Only callable when instructions.length > 1 (enforced in JSX).
 * @param {number} i
 * @returns {void}
 */
const removeInstruction = (i): void

/**
 * Form submit handler. Calls toPayload(form), passes result to props.onSubmit().
 * Sets loading=true during submission. Catches errors from onSubmit and
 * displays them inline via setError(). Always sets loading=false in finally.
 * @param {React.FormEvent<HTMLFormElement>} e
 * @returns {Promise<void>}
 */
const handleSubmit = async (e): Promise<void>
```

---

## States

### 1. Create mode (`initialData` is undefined)
All fields are empty/default:
- `title`: `''`
- `category`: `'Other'`
- `difficulty`: `'Medium'`
- `prepTime`, `cookTime`, `servings`: `''`
- `tags`: `''`
- `notes`: `''`
- `ingredients`: one blank row
- `instructions`: one blank step

### 2. Edit mode (`initialData` is a RecipeData object)
All fields pre-populated from `initialData` via `toFormState()`. Tags are joined to a comma string. Ingredient amounts are stringified. Category and difficulty default to `'Other'` / `'Medium'` if missing from the API data.

### 3. Submitting (`loading = true`)
Submit button shows `'Saving…'` and is `disabled`. All inputs remain editable.

### 4. Error (`error` is non-empty)
An inline error `<p>` appears above the submit button. The form remains editable and submittable.

---

## Behavior

| Trigger | Action |
|---------|--------|
| Change any simple input/select | `set(field, value)` updates form state |
| Change ingredient field | `setIngredient(i, field, value)` |
| Click "+ Add Ingredient" | Appends blank ingredient row |
| Click ✕ on ingredient row | Removes that row (only when > 1 row exists) |
| Change instruction textarea | `setInstruction(i, value)` |
| Click "+ Add Step" | Appends blank instruction step |
| Click ✕ on step | Removes that step (only when > 1 step exists) |
| Submit form | `handleSubmit` → `toPayload(form)` → `onSubmit(payload)` |
| `onSubmit` resolves | Parent handles navigation — RecipeForm does nothing after |
| `onSubmit` rejects | Error message shown inline; loading reset to false |

---

## Layout

```
Title *                          [input]
Category                         [select: Breakfast | Lunch | … | Other]
Difficulty                       [select: Easy | Medium | Hard]
[Prep Time (min)] [Cook Time (min)] [Servings]   ← 3-column grid

Ingredients *
  [Name          ] [Amount] [Unit     ] [✕]
  [Name          ] [Amount] [Unit     ] [✕]
  + Add Ingredient

Instructions
  1  [textarea                        ] [✕]
  2  [textarea                        ] [✕]
  + Add Step

Tags (comma-separated)           [input]
Notes                            [textarea]

                                 [error message if any]
                          [Save Recipe]
```

Category sits between Title and Difficulty. The Difficulty select remains directly above the Times grid.

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Form wrapper | `flex flex-col gap-5 max-w-2xl` |
| Field label | `.field-label` |
| Text/number inputs | `.input` |
| Category `<select>` | `.input` |
| Difficulty `<select>` | `.input` |
| Times/servings grid | `grid grid-cols-3 gap-4` |
| Ingredient row | `flex gap-2 items-center` |
| Name input | `.input flex-[2]` |
| Amount input | `.input flex-1` |
| Unit input | `.input flex-1` |
| Remove button (✕) | `text-terracotta-400 hover:text-terracotta-600 text-lg leading-none cursor-pointer border-0 bg-transparent p-1 transition-colors` |
| Add row/step button | `mt-2 border border-dashed border-cream-300 hover:border-sage-400 text-sage-500 hover:text-sage-700 text-sm px-3 py-1.5 rounded transition-colors cursor-pointer bg-transparent` |
| Error `<p>` | `text-terracotta-600 text-sm` |
| Submit button | `.btn-primary self-start mt-2` |

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| All inputs and selects | Have a `<label>` with `className="field-label"` above them |
| Category `<select>` | `<label className="field-label">Category</label>` |
| Ingredient remove button | `type="button"` to prevent form submission; visible ✕ character |
| Step remove button | `type="button"` to prevent form submission |
| Add buttons | `type="button"` to prevent form submission |
| Submit button | `type="submit"`, `disabled` during loading |

---

## Integration

RecipeForm is used identically in both pages:

```jsx
// CreateRecipePage.jsx
<RecipeForm
  onSubmit={async (payload) => {
    const recipe = await createRecipe(payload);
    navigate(`/recipes/${recipe._id}`);
  }}
  submitLabel="Create Recipe"
/>

// EditRecipePage.jsx
<RecipeForm
  initialData={recipe}   // fetched recipe object
  onSubmit={async (payload) => {
    await updateRecipe(id, payload);
    navigate(`/recipes/${id}`);
  }}
  submitLabel="Save Changes"
/>
```

RecipeForm never calls the API directly. It never navigates. Error handling for API failures is done inside `handleSubmit` via the `error` state.

---

## Test cases

File: `frontend/src/components/__tests__/RecipeForm.test.jsx`

Mock setup:
```js
vi.mock('../../hooks/useAuth', () => ({ default: () => ({ user: { id: '1' } }) }));
```
No MemoryRouter needed — RecipeForm has no router dependency.

**`toFormState` unit tests:**

| # | Test | What to assert |
|---|------|----------------|
| 1 | Returns correct defaults when called with undefined | title='', category='Other', difficulty='Medium', one blank ingredient, one blank step |
| 2 | Converts ingredient amounts from Number to String | `toFormState({ ingredients: [{ name:'egg', amount: 2, unit:'pcs' }] })` → amount is `'2'` |
| 3 | Joins tags array to comma string | `tags: ['a','b']` → `'a, b'` |
| 4 | Defaults category to 'Other' when absent | `toFormState({})` → `category: 'Other'` |
| 5 | Reads category from data when present | `toFormState({ category: 'Dinner' })` → `category: 'Dinner'` |

**`toPayload` unit tests:**

| # | Test | What to assert |
|---|------|----------------|
| 6 | Converts ingredient amounts from String to Number | `amount: '2'` → `amount: 2` |
| 7 | Splits tags string to array | `tags: 'a, b, c'` → `['a','b','c']` |
| 8 | Filters blank ingredients | Row with empty name is excluded from payload |
| 9 | Filters blank instructions | Empty-string steps excluded from payload |
| 10 | Converts non-empty time strings to Number | `prepTime: '15'` → `15` |
| 11 | Sets time to undefined when empty string | `prepTime: ''` → `undefined` |
| 12 | Includes category in payload | `category: 'Dinner'` is present in output |

**Component render tests:**

| # | Test | What to assert |
|---|------|----------------|
| 13 | Renders without crashing | No thrown errors |
| 14 | Renders all field labels | Title, Category, Difficulty, Prep Time, Cook Time, Servings, Ingredients, Instructions, Tags, Notes |
| 15 | Category select defaults to 'Other' in create mode | Select value is `'Other'` |
| 16 | Category select pre-populated in edit mode | `initialData.category='Dinner'` → select shows 'Dinner' |
| 17 | All 7 category options are present | One `<option>` for each of Breakfast…Other |
| 18 | Difficulty select defaults to 'Medium' | Select value is `'Medium'` |
| 19 | Submit button shows submitLabel | `getByRole('button', { name: 'Create Recipe' })` when passed as prop |
| 20 | Submit button disabled and shows 'Saving…' during submission | Mock onSubmit that never resolves; assert disabled state |
| 21 | Calls onSubmit with correct payload on submit | Fill title, submit; assert onSubmit called with payload containing title |
| 22 | Shows error message when onSubmit rejects | onSubmit throws `{ response: { data: { message: 'fail' } } }`; assert error text visible |
| 23 | "+ Add Ingredient" appends a new row | Click → one more ingredient row visible |
| 24 | ✕ removes an ingredient row | Add row, click ✕ → back to original count |
| 25 | ✕ on ingredient hidden when only one row | With one ingredient, remove button not present |
