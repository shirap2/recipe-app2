# Toast

## Purpose
Fixed-position, auto-dismissing notification that replaces inline `<p>` error/success messages with a non-blocking overlay.

---

## Files

- CREATE `frontend/src/components/Toast.jsx` — renders the visible toast stack
- CREATE `frontend/src/context/ToastContext.jsx` — manages toast queue state, provides `showToast()`
- CREATE `frontend/src/hooks/useToast.js` — `useContext(ToastContext)` wrapper
- MODIFY `frontend/src/App.jsx` — wrap the router with `<ToastProvider>`

> **No props are passed into the pages to trigger toasts.** Any component calls `useToast()` to get `showToast()` and fires it directly.

---

## Props

### `<Toast>` (internal — rendered by `ToastProvider`, not used directly)

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `toast` | `ToastMessage` | Yes | — | The toast object to render (see data types) |
| `onDismiss` | `(id: string) => void` | Yes | — | Called when the X button is clicked or auto-dismiss fires |

### `<ToastProvider>` (placed in `App.jsx`)

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `ReactNode` | Yes | — | The rest of the app |

### `showToast()` (from `useToast()`)

| Param | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `message` | `string` | Yes | — | Text displayed in the toast |
| `variant` | `'success' \| 'error'` | Yes | — | Controls color scheme and icon |
| `duration` | `number` | No | `4000` | Auto-dismiss delay in ms. Pass `0` to disable auto-dismiss. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `useState`, `useCallback`, `useEffect`, `useContext`, `createContext` | `react` | Context, state, auto-dismiss timer |

No router dependency. No API calls. No `useAuth`. Fully self-contained.

---

## Signatures & Data Types

### Data types

```ts
/**
 * A single toast notification in the queue.
 */
type ToastMessage = {
  id:       string;                // crypto.randomUUID() — used as React key + dismiss target
  message:  string;                // Displayed verbatim
  variant:  'success' | 'error';  // Controls icon and color
  duration: number;                // ms until auto-dismiss; 0 = no auto-dismiss
}
```

### `ToastContext`

```ts
type ToastContextValue = {
  /**
   * Adds a toast to the queue. Auto-dismisses after `duration` ms.
   * Can be called from any component inside ToastProvider.
   */
  showToast: (message: string, variant: 'success' | 'error', duration?: number) => void;
}
```

### `ToastProvider` component

```js
/**
 * Maintains the active toast queue and renders the Toast stack portal.
 * Wrap the entire app (inside BrowserRouter) with this provider.
 * @param {{ children: ReactNode }} props
 * @returns {JSX.Element}
 */
export function ToastProvider({ children }): JSX.Element
```

### `useToast` hook

```js
/**
 * Returns { showToast } from ToastContext.
 * Must be called inside a component that is a descendant of ToastProvider.
 * Throws if called outside the provider:
 *   throw new Error('useToast must be used inside ToastProvider')
 * @returns {ToastContextValue}
 */
export default function useToast(): ToastContextValue
```

### `Toast` component (internal)

```js
/**
 * Renders a single toast notification row.
 * Called by ToastProvider for each item in the queue.
 * @param {{ toast: ToastMessage, onDismiss: (id: string) => void }} props
 * @returns {JSX.Element}
 */
function Toast({ toast, onDismiss }): JSX.Element
```

### Internal functions inside `ToastProvider`

```js
/**
 * Creates a ToastMessage with a unique id and adds it to the queue.
 * Schedules auto-dismiss via setTimeout if duration > 0.
 * Wrapped in useCallback — the reference is stable across renders so
 * consumers can safely include it in useEffect dependency arrays.
 * @param {string} message
 * @param {'success' | 'error'} variant
 * @param {number} [duration=4000]
 * @returns {void}
 */
const showToast: (message: string, variant: 'success' | 'error', duration?: number) => void

/**
 * Removes the toast with the given id from the queue.
 * Called on auto-dismiss timeout and on manual X click.
 * @param {string} id
 * @returns {void}
 */
function dismissToast(id: string): void
```

### Internal state inside `ToastProvider`

```ts
/**
 * Active toast queue. New toasts are appended to the end.
 * Each toast is removed individually after its duration or on manual dismiss.
 */
const [toasts, setToasts] = useState<ToastMessage[]>([]);
```

### Auto-dismiss implementation note

Auto-dismiss is set up inside the `Toast` component using `useEffect`:

```js
useEffect(() => {
  if (toast.duration === 0) return;
  const timer = setTimeout(() => onDismiss(toast.id), toast.duration);
  return () => clearTimeout(timer);  // cleans up if the toast is manually dismissed first
}, [toast.id, toast.duration, onDismiss]);
```

This approach avoids stale-closure issues with `setTimeout` managed in the parent.

---

## States

### 1. No toasts
Nothing is rendered. The container `<div>` exists in the DOM but is empty.

### 2. Single toast — success
```
┌─────────────────────────────────────┐
│  ✓  Recipe saved successfully.   [×]│
└─────────────────────────────────────┘
```
Sage green background, check icon, white text, close button.

### 3. Single toast — error
```
┌─────────────────────────────────────┐
│  ✕  Failed to load recipes.      [×]│
└─────────────────────────────────────┘
```
Terracotta background, X icon, white text, close button.

### 4. Multiple toasts (stacked)
```
┌─────────────────────────────────────┐
│  ✓  Recipe saved successfully.   [×]│
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  ✕  Search failed.               [×]│
└─────────────────────────────────────┘
```
Each toast is independently dismissible and has its own timer.

---

## Behavior

| Event | Action |
|-------|--------|
| `showToast(msg, 'success')` called | Toast appended to queue; auto-dismiss starts at 4000ms |
| `showToast(msg, 'error')` called | Toast appended to queue; auto-dismiss starts at 4000ms |
| `showToast(msg, variant, 0)` called | Toast appended; **no** auto-dismiss — only manual close |
| Auto-dismiss timer fires | `dismissToast(id)` called, toast removed from queue |
| User clicks [×] button | `dismissToast(id)` called immediately, timer cleared |
| Multiple `showToast` calls in rapid succession | All toasts added to queue; each has its own timer and dismiss button |

**No debouncing or deduplication** — if the same error fires twice, two toasts appear. This keeps the logic simple; callers are responsible for not flooding.

---

## Layout

### Stack container

Fixed to the bottom-right corner of the viewport. Renders above all other content via `z-50`.

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  (page content)                                                      │
│                                              ┌──────────────────┐   │
│                                              │  ✓  Saved.    [×]│   │
│                                              └──────────────────┘   │
│                                              ┌──────────────────┐   │
│                                              │  ✕  Error.    [×]│   │
│                                              └──────────────────┘   │
└──────────────────────────────────────────────────────────────────────┘
```

Container classes: `fixed bottom-6 right-6 z-50 flex flex-col gap-2`

### Individual toast

```
┌─────────────────────────────────────────┐
│  [icon]  message text             [×]   │
└─────────────────────────────────────────┘
```

- `min-w-64 max-w-xs` — prevents very short or very wide toasts
- `flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg`
- Icon: inline text character — `✓` for success, `✕` for error — wrapped in `<span aria-hidden="true">`
- Message: `<span>` with `flex-1 text-sm font-medium`
- Close button: `<button type="button">` with `×` character

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Stack container | `fixed bottom-6 right-6 z-50 flex flex-col gap-2` |
| Toast (success) | `bg-sage-600 text-white` |
| Toast (error) | `bg-terracotta-500 text-white` |
| Toast shared | `min-w-64 max-w-xs flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg` |
| Icon `<span>` | `text-base font-bold` |
| Message `<span>` | `flex-1 text-sm font-medium` |
| Close `<button>` | `ml-auto text-white/70 hover:text-white transition-colors cursor-pointer bg-transparent border-0 text-lg leading-none` |

No new colors are introduced. Sage and terracotta from `index.css` are used. No `@layer components` class is needed — the toast is a single-use layout, not a repeating pattern.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Stack container `<div>` | `role="region"` + `aria-label="Notifications"` |
| Each toast `<div>` | `role="alert"` — causes screen readers to announce it immediately on mount |
| Icon `<span>` | `aria-hidden="true"` — decorative; variant is already conveyed by the `role="alert"` and message text |
| Close `<button>` | `type="button"` + `aria-label="Dismiss notification"` — the `×` character alone is not sufficient for screen readers |

The `role="alert"` on each toast ensures the message is read aloud by screen readers without requiring focus to move to the toast. No focus management is needed.

---

## Integration: replacing inline error `<p>` elements

Existing pages use patterns like:

```jsx
// RecipesPage.jsx — inline, blocking
{error && <p className="text-terracotta-600">{error}</p>}

// LoginPage.jsx — inline with card styling
{error && (
  <p className="text-terracotta-600 text-sm bg-terracotta-50 border border-terracotta-200 rounded px-3 py-2">
    {error}
  </p>
)}
```

After Toast is implemented, pages that benefit from non-blocking feedback can migrate to:

```jsx
// In the component
const { showToast } = useToast();

// In a catch block
catch {
  showToast('Failed to load recipes.', 'error');
}

// On success
showToast('Recipe saved.', 'success');
```

**Migration is not required for all pages at once.** The inline `<p>` pattern is acceptable for form validation errors (login/register) where the error should stay visible while the user corrects their input. Toast is most appropriate for:
- API errors from list/detail pages (`RecipesPage`, `RecipeDetailPage`)
- Success confirmations after create/edit/delete

**Login and Register page form errors** (wrong credentials, duplicate username) may stay as inline `<p>` elements — they are contextually tied to the form and should not disappear on a timer.

---

## App.jsx integration

```jsx
// App.jsx — wrap routes with ToastProvider inside BrowserRouter
import { ToastProvider } from './context/ToastContext';

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* routes */}
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
```

`ToastProvider` sits inside `BrowserRouter` and `AuthProvider`. Inside `BrowserRouter` ensures any future toast containing a `<Link>` won't silently break. Inside `AuthProvider` ensures auth-aware components can trigger toasts.

---

## Test cases

### `ToastContext` / `useToast` — `frontend/src/context/__tests__/ToastContext.test.jsx`

| # | Test | What to assert |
|---|------|----------------|
| 1 | `useToast` throws if called outside `ToastProvider` | Calling the hook without a provider throws a meaningful error |
| 2 | `showToast` renders a toast with the correct message | Render a test consumer, call `showToast('Hello', 'success')`, assert `getByText('Hello')` is present |
| 3 | `showToast` with `'error'` variant renders the error toast | Assert the toast element has the error color classes |
| 4 | `showToast` with `'success'` variant renders the success toast | Assert the toast element has the success color classes |
| 5 | Toast auto-dismisses after `duration` ms | Use `vi.useFakeTimers()`, call `showToast('msg', 'error', 1000)`, advance timers by 1000ms, assert toast is gone |
| 6 | Toast with `duration: 0` does not auto-dismiss | Advance timers by 10 000ms, assert toast is still present |
| 7 | Multiple `showToast` calls render multiple toasts | Call twice, assert both messages are in the DOM |
| 8 | Dismissing one toast does not affect others | Call twice, dismiss one via X button, assert only the other remains |

### `Toast` component — `frontend/src/components/__tests__/Toast.test.jsx`

No mocks required beyond a minimal `toast` prop. Wrap in a plain `<div>` — no router or auth needed.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Displays the message text | `getByText(toast.message)` is present |
| 3 | Close button is present and accessible | `getByRole('button', { name: 'Dismiss notification' })` resolves |
| 4 | Clicking close button calls `onDismiss` with the toast id | Click × → `onDismiss` mock called with `toast.id` |
| 5 | `role="alert"` is set on the toast container | `getByRole('alert')` resolves |
| 6 | Icon is hidden from accessibility tree | Icon `<span>` has `aria-hidden="true"` |
| 7 | Success toast has sage background class | Container element includes `bg-sage-600` |
| 8 | Error toast has terracotta background class | Container element includes `bg-terracotta-500` |
