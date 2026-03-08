# ConfirmDialog

## Purpose
Inline styled replacement for `window.confirm()` — renders a trigger button that, when clicked, expands in-place into a confirmation message with Confirm and Cancel buttons.

---

## Files
- CREATE `frontend/src/components/ConfirmDialog.jsx`
- MODIFY `frontend/src/pages/RecipeDetailPage.jsx` — replace `window.confirm()` in `handleDelete` with `<ConfirmDialog>`

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `message` | `string` | Yes | — | Confirmation question shown when pending. E.g. `'Delete "Pasta"? This cannot be undone.'` |
| `onConfirm` | `() => void \| Promise<void>` | Yes | — | Called when the user clicks the confirm button. May be async. |
| `triggerLabel` | `string` | Yes | — | Label on the trigger button in its resting state. E.g. `"Delete"` |
| `triggerClassName` | `string` | No | `"btn-danger"` | CSS classes applied to the trigger button. Pass a different class to reuse the component for non-destructive confirmations. |
| `confirmLabel` | `string` | No | `"Yes, delete"` | Label on the confirm button shown in pending state. |
| `cancelLabel` | `string` | No | `"Cancel"` | Label on the cancel button shown in pending state. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `useState` | `react` | Manages `pending` state internally |

No router, no API calls, no context. This component is fully self-contained.

---

## Signatures & Data Types

### Component

```js
/**
 * Inline confirmation component that replaces window.confirm().
 * Renders a trigger button; on click, expands to show a message
 * with Confirm and Cancel buttons in-place.
 *
 * @param {ConfirmDialogProps} props
 * @returns {JSX.Element}
 */
export default function ConfirmDialog(props: ConfirmDialogProps): JSX.Element
```

### Props type

```ts
type ConfirmDialogProps = {
  message:          string;                    // Displayed verbatim in the pending state
  onConfirm:        () => void | Promise<void>; // Async-safe — component awaits it internally
  triggerLabel:     string;                    // Button text in resting state
  triggerClassName?: string;                   // Defaults to "btn-danger"
  confirmLabel?:    string;                    // Defaults to "Yes, delete"
  cancelLabel?:     string;                    // Defaults to "Cancel"
}
```

### Internal state

```ts
/**
 * Whether the confirmation row is currently visible.
 * false → trigger button is shown.
 * true  → message + Confirm + Cancel are shown.
 */
const [pending, setPending] = useState<boolean>(false);
```

### Internal functions

```js
/**
 * Switches the component into pending state.
 * Called by the trigger button's onClick.
 * @returns {void}
 */
function handleTriggerClick(): void

/**
 * Calls props.onConfirm(), then resets pending to false.
 * Awaits onConfirm in case it is async (e.g. an API delete call).
 * Does NOT catch errors — the parent is responsible for error handling.
 * @returns {Promise<void>}
 */
async function handleConfirm(): Promise<void>

/**
 * Resets pending to false without calling onConfirm.
 * Called by the Cancel button's onClick.
 * @returns {void}
 */
function handleCancel(): void
```

### Data types produced

None. `ConfirmDialog` calls `onConfirm` as a side effect and manages its own visual state. It produces no return values and sets no external state.

---

## States

### 1. Resting (`pending = false`)
Only the trigger button is rendered.
```
[Delete]
```

### 2. Pending (`pending = true`)
The trigger button is replaced by a flex row: message text, then Confirm button, then Cancel button — all on one line.
```
Delete "Pasta"? This cannot be undone.   [Yes, delete]  [Cancel]
```

There is no loading state. If `onConfirm` is async, the UI does not show a spinner — the parent page is responsible for any loading feedback after the action completes.

---

## Behavior

| Trigger | Action |
|---------|--------|
| Click trigger button | `setPending(true)` — trigger button disappears, confirmation row appears |
| Click "Yes, delete" | `await onConfirm()`, then `setPending(false)` |
| Click "Cancel" | `setPending(false)` — returns to resting state, nothing is called |
| `onConfirm` throws | Error propagates to the caller — `ConfirmDialog` does not catch it. `pending` stays `false` after the throw. |

**Important:** `ConfirmDialog` does not handle navigation, success messages, or error display. Those remain the parent's responsibility, exactly as they were when `window.confirm` was used.

---

## Layout

### Resting state
```
[triggerLabel]
```
The trigger button renders inline — it sits naturally in whatever flex row or div the parent places it in.

### Pending state
```
┌─────────────────────────────────────────────────────┐
│  message text            [confirmLabel]  [cancelLabel]│
└─────────────────────────────────────────────────────┘
```
- Flex row, `items-center`, `gap-3`, `flex-wrap` (wraps on narrow viewports)
- Message text is left-aligned, `text-sm`, `text-sage-700`
- Buttons follow the message text in the same row

---

## Integration: replacing `window.confirm` in `RecipeDetailPage.jsx`

**Before (current broken code):**
```jsx
const handleDelete = async () => {
  if (!window.confirm(`Delete "${recipe.title}"? This cannot be undone.`)) return;
  try {
    await deleteRecipe(id);
    navigate('/recipes');
  } catch {
    setError('Failed to delete recipe.');
  }
};

<button onClick={handleDelete} className="btn-danger">Delete</button>
```

**After:**
```jsx
// handleDelete no longer needs the window.confirm guard — ConfirmDialog handles that
const handleDelete = async () => {
  try {
    await deleteRecipe(id);
    navigate('/recipes');
  } catch {
    setError('Failed to delete recipe.');
  }
};

<ConfirmDialog
  triggerLabel="Delete"
  message={`Delete "${recipe.title}"? This cannot be undone.`}
  onConfirm={handleDelete}
/>
```

`triggerClassName` is omitted — the default `"btn-danger"` matches the existing button style exactly.

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Trigger button | `{triggerClassName}` (default: `btn-danger`) |
| Pending wrapper | `flex items-center gap-3 flex-wrap` |
| Message text | `text-sm text-sage-700` |
| Confirm button | `btn-danger` |
| Cancel button | `btn-ghost` |

No new colors. No inline styles. No custom classes needed — all patterns are covered by existing `index.css` component classes.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Trigger button | `type="button"` — prevents accidental form submission if ConfirmDialog is ever placed inside a `<form>` |
| Confirm button | `type="button"`, visible label from `confirmLabel` prop |
| Cancel button | `type="button"`, visible label from `cancelLabel` prop |
| Pending message | Plain `<p>` or `<span>` — no ARIA role needed; it is visible text |

No `role="dialog"` or focus trapping is required because this is an inline component, not a modal overlay.

---

## Related bugs

### BUG-005 — Delete uses `window.confirm()`
**Where:** `RecipeDetailPage.jsx:26`

This component directly fixes BUG-005. After implementation, `window.confirm` must be removed from `RecipeDetailPage.jsx`. Search the entire codebase for any other `window.confirm()` or `window.alert()` calls — if found, they are candidates for the same replacement.

---

## Test cases

File: `frontend/src/components/__tests__/ConfirmDialog.test.jsx`

No mocks required. ConfirmDialog has no external dependencies.
Wrap renders in `<MemoryRouter>` is not needed — this component has no router dependency.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Resting state: trigger button is visible | `getByRole('button', { name: 'Delete' })` present |
| 3 | Resting state: confirmation row is not visible | `queryByText('Yes, delete')` is null |
| 4 | Clicking trigger shows confirmation row | After click: `getByText('Are you sure…')` visible, trigger button gone |
| 5 | Confirmation row shows the message prop verbatim | `getByText(message)` is present after trigger click |
| 6 | Clicking Cancel returns to resting state | After Cancel click: trigger button re-appears, confirmation row gone, `onConfirm` not called |
| 7 | Clicking Confirm calls `onConfirm` once | `onConfirm` mock called exactly once |
| 8 | Custom `triggerLabel` is rendered | `getByRole('button', { name: 'Remove friend' })` when `triggerLabel="Remove friend"` |
| 9 | Custom `confirmLabel` and `cancelLabel` are rendered | Respective text appears in pending state |
| 10 | Trigger button is accessible | `getByRole('button', { name: triggerLabel })` resolves |
| 11 | Confirm and Cancel buttons are accessible | Both resolve via `getByRole('button', { name: … })` |
