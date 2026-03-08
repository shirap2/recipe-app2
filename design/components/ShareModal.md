# ShareModal

## Purpose
Modal overlay that lets the recipe owner share or unshare a recipe with individual friends, with a client-side filter to find friends quickly.

---

## Files

- CREATE `frontend/src/components/ShareModal.jsx`
- MODIFY `frontend/src/pages/RecipeDetailPage.jsx` — add "Share" button that opens the modal; pass `recipe.sharedWith` as prop
- MODIFY `frontend/src/api/recipesApi.js` — add `shareRecipe()` and `unshareRecipe()`
- CREATE `frontend/src/api/usersApi.js` — add `getFriends()` (and `searchUsers()` for the friends feature)

### Prerequisite dependencies

ShareModal depends on two post-MVP features that must exist before implementation:

| Dependency | Status | Defined in |
|------------|--------|------------|
| `GET /api/users/friends` endpoint | Planned | `system_design.md §10.4` |
| `POST /api/recipes/:id/share` endpoint | Planned | `system_design.md §10.5` |
| `DELETE /api/recipes/:id/share/:userId` endpoint | Planned | `system_design.md §10.5` |
| `Recipe.sharedWith: [ObjectId]` field | Planned | `system_design.md §4.2` |

Do not implement ShareModal until these endpoints exist and `recipe.sharedWith` is returned by `GET /api/recipes/:id`.

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `recipeId` | `string` | Yes | — | MongoDB ObjectId of the recipe being shared. Used in `shareRecipe` / `unshareRecipe` API calls. |
| `recipeTitle` | `string` | Yes | — | Displayed in the modal header: `Share "${recipeTitle}"`. |
| `sharedWith` | `string[]` | Yes | — | Array of user ObjectIds the recipe is already shared with. Initialises the local shared state. |
| `isOpen` | `boolean` | Yes | — | Controls modal visibility. Parent owns this — modal does not close itself. |
| `onClose` | `() => void` | Yes | — | Called when the user clicks the backdrop, the × button, or presses Escape. |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `useState`, `useEffect`, `useRef` | `react` | Local state, friends fetch on open, focus trap ref |
| `getFriends` | `../api/usersApi` | Fetches the authenticated user's friends list |
| `shareRecipe`, `unshareRecipe` | `../api/recipesApi` | Share / unshare API calls |
| `useToast` | `../hooks/useToast` | Success and error toasts after share/unshare actions |

No router dependency. No `useAuth` — the friends list is already scoped to the current user by the backend.

---

## New API functions

### `frontend/src/api/usersApi.js`

```js
/**
 * Fetches the authenticated user's accepted friends.
 * GET /api/users/friends
 * @returns {Promise<FriendUser[]>}
 */
export const getFriends = async () => {
  const res = await axiosInstance.get('/users/friends');
  return res.data;
};
```

### Additions to `frontend/src/api/recipesApi.js`

```js
/**
 * Shares the recipe with a specific user.
 * POST /api/recipes/:recipeId/share   body: { userId }
 * @param {string} recipeId
 * @param {string} userId
 * @returns {Promise<{ message: string }>}
 */
export const shareRecipe = async (recipeId, userId) => {
  const res = await axiosInstance.post(`/recipes/${recipeId}/share`, { userId });
  return res.data;
};

/**
 * Removes a user's access to the recipe.
 * DELETE /api/recipes/:recipeId/share/:userId
 * @param {string} recipeId
 * @param {string} userId
 * @returns {Promise<{ message: string }>}
 */
export const unshareRecipe = async (recipeId, userId) => {
  const res = await axiosInstance.delete(`/recipes/${recipeId}/share/${userId}`);
  return res.data;
};
```

---

## Signatures & Data Types

### Data types consumed

```ts
/**
 * A friend entry returned by GET /api/users/friends.
 * Only username and _id are needed by ShareModal.
 */
type FriendUser = {
  _id:      string;   // MongoDB ObjectId as hex string — used as React key and in API calls
  username: string;   // Displayed in each row
}
```

### Component

```js
/**
 * Modal for sharing/unsharing a recipe with friends.
 * Fetches the friend list when opened. Manages share state locally
 * with optimistic updates; shows toasts on success/failure.
 *
 * @param {ShareModalProps} props
 * @returns {JSX.Element | null}  Returns null when isOpen is false.
 */
export default function ShareModal(props: ShareModalProps): JSX.Element | null
```

### Props type

```ts
type ShareModalProps = {
  recipeId:    string;
  recipeTitle: string;
  sharedWith:  string[];         // User ObjectIds — initialises localShared Set
  isOpen:      boolean;
  onClose:     () => void;
}
```

### Internal state

```ts
/**
 * Friends list fetched from GET /api/users/friends.
 * Populated when the modal opens. Empty array before first fetch.
 */
const [friends, setFriends] = useState<FriendUser[]>([]);

/**
 * Whether the friends list is currently loading.
 */
const [loading, setLoading] = useState<boolean>(false);

/**
 * Error message if the friends fetch fails. Empty string = no error.
 */
const [fetchError, setFetchError] = useState<string>('');

/**
 * Client-side filter applied to the friends list.
 * Filters by username substring, case-insensitive. No API call on change.
 */
const [filter, setFilter] = useState<string>('');

/**
 * Tracks which user IDs the recipe is currently shared with.
 * Initialised from props.sharedWith. Updated locally on share/unshare
 * so the UI reflects changes immediately without a page reload.
 */
const [localShared, setLocalShared] = useState<Set<string>>(new Set(sharedWith));

/**
 * User IDs of in-flight share/unshare requests.
 * Used to disable the per-row button while the request is pending.
 */
const [pending, setPending] = useState<Set<string>>(new Set());
```

### Internal functions

```js
/**
 * Fetches the user's friends list and populates `friends`.
 * Called in useEffect when isOpen becomes true.
 * Resets filter and fetchError on each open.
 * @returns {Promise<void>}
 */
async function loadFriends(): Promise<void>

/**
 * Shares the recipe with the given friend.
 * Adds userId to `pending`, calls shareRecipe(), then adds to `localShared`.
 * Shows a success toast on success; shows an error toast on failure.
 * Always removes userId from `pending` in the finally block.
 * @param {FriendUser} friend
 * @returns {Promise<void>}
 */
async function handleShare(friend: FriendUser): Promise<void>

/**
 * Removes the share for the given friend.
 * Adds userId to `pending`, calls unshareRecipe(), then removes from `localShared`.
 * Shows a success toast on success; shows an error toast on failure.
 * Always removes userId from `pending` in the finally block.
 * @param {FriendUser} friend
 * @returns {Promise<void>}
 */
async function handleUnshare(friend: FriendUser): Promise<void>

/**
 * Keyboard handler attached to the modal panel.
 * Calls onClose() when the Escape key is pressed.
 * @param {KeyboardEvent} e
 * @returns {void}
 */
function handleKeyDown(e: KeyboardEvent): void
```

### Derived values (not state)

```ts
/**
 * Friends filtered by the current search string.
 * Computed inline during render — not stored in state.
 * Empty filter → full list.
 */
const filteredFriends: FriendUser[] = friends.filter(f =>
  f.username.toLowerCase().includes(filter.toLowerCase())
);
```

---

## States

### 1. Closed (`isOpen = false`)
Component returns `null`. Nothing is rendered.

### 2. Open — loading friends
Backdrop and modal panel visible. Friends list area shows a loading message. Filter input disabled.
```
┌──────────────────────────────────────┐
│  Share "Pasta Carbonara"          [×]│
│  ──────────────────────────────────  │
│  [Filter friends…            ]       │
│                                      │
│  Loading friends…                    │
└──────────────────────────────────────┘
```

### 3. Open — no friends
Friends list is empty (user has no friends yet).
```
┌──────────────────────────────────────┐
│  Share "Pasta Carbonara"          [×]│
│  ──────────────────────────────────  │
│  [Filter friends…            ]       │
│                                      │
│  You haven't added any friends yet.  │
└──────────────────────────────────────┘
```

### 4. Open — friends list with mixed share status
```
┌──────────────────────────────────────┐
│  Share "Pasta Carbonara"          [×]│
│  ──────────────────────────────────  │
│  [Filter friends…            ]       │
│                                      │
│  alice                  [Share]      │
│  bob                    [Remove]     │
│  carol                  [Share]      │
│                                      │
└──────────────────────────────────────┘
```
- "Share" buttons appear for friends not in `localShared`
- "Remove" buttons appear for friends in `localShared`

### 5. Open — row in-flight (`pending` contains userId)
The button for that row is disabled and shows a loading label. Other rows remain interactive.
```
│  alice                  [Sharing…]   │  ← disabled
│  bob                    [Remove]     │  ← still active
```

### 6. Open — filter active, no matches
```
│  [xyz                        ]       │
│                                      │
│  No friends match "xyz".             │
```

### 7. Open — friends fetch failed
```
┌──────────────────────────────────────┐
│  Share "Pasta Carbonara"          [×]│
│  ──────────────────────────────────  │
│  Could not load friends.             │
│  [Try again]                         │
└──────────────────────────────────────┘
```
A "Try again" button calls `loadFriends()` again. Filter input is hidden in this state.

---

## Behavior

| Trigger | Action |
|---------|--------|
| `isOpen` becomes `true` | Call `loadFriends()`; reset `filter` to `''`; reset `fetchError` to `''` |
| `isOpen` becomes `false` | `localShared` and `friends` are reset on the next open (by `loadFriends()`) |
| User types in filter input | Update `filter`; `filteredFriends` recomputes inline; no API call |
| Click "Share" on a friend row | Call `handleShare(friend)` — adds to `pending`, calls API, updates `localShared`, shows toast |
| Click "Remove" on a friend row | Call `handleUnshare(friend)` — adds to `pending`, calls API, updates `localShared`, shows toast |
| Share succeeds | `showToast('Recipe shared with @alice.', 'success')` |
| Share fails | `showToast('Failed to share recipe. Try again.', 'error')` — row reverts to "Share" |
| Unshare succeeds | `showToast('@alice can no longer access this recipe.', 'success')` |
| Unshare fails | `showToast('Failed to remove access. Try again.', 'error')` — row reverts to "Remove" |
| Click × button | `onClose()` |
| Click backdrop | `onClose()` |
| Press Escape | `onClose()` |
| Click "Try again" (fetch error) | Re-call `loadFriends()` |

**Optimistic updates:** `localShared` is updated immediately after a successful API call. No page reload or parent state refresh is needed for the modal to reflect the new share status. The parent (`RecipeDetailPage`) does not need to know about share changes during a session — it only needs to pass the initial `sharedWith` when the modal opens.

**Modal does not close after a share action** — the user may want to share with multiple friends in one session.

---

## Layout

### Backdrop
```
fixed inset-0 z-50 flex items-center justify-center bg-sage-900/50
```
Clicking the backdrop element itself calls `onClose()`. Clicking the modal panel does not propagate to the backdrop (use `e.stopPropagation()`).

### Modal panel
```
bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]
```
`max-h-[80vh]` prevents the modal from overflowing the viewport when a user has many friends. The friends list section is scrollable.

### Structure
```
┌─────────────────────────────────────────┐
│ Header (shrink-0)                        │
│   title                        [×]      │
│ ─────────────────────────────────────── │
│ Filter input (shrink-0)                  │
│   [Filter friends…                 ]    │
│ ─────────────────────────────────────── │
│ Body (overflow-y-auto, flex-1)           │
│   friend row                            │
│   friend row                            │
│   friend row                            │
│   …                                     │
└─────────────────────────────────────────┘
```

### Friend row
```
flex items-center justify-between px-4 py-3 border-b border-cream-100 last:border-0
```
- Left: `<span className="text-sm font-medium text-sage-900">@{username}</span>`
- Right: Share or Remove button

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Backdrop | `fixed inset-0 z-50 flex items-center justify-center bg-sage-900/50` |
| Modal panel | `bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]` |
| Header | `flex items-center justify-between px-5 py-4 border-b border-cream-200 shrink-0` |
| Modal title | `text-sage-900 font-bold text-base` |
| Close (×) button | `text-sage-400 hover:text-sage-700 transition-colors cursor-pointer bg-transparent border-0 text-xl leading-none` |
| Filter input | `input mx-4 my-3` (reuses `.input` from `index.css`), wrapped in `shrink-0` div |
| Friends list body | `overflow-y-auto flex-1` |
| Friend row | `flex items-center justify-between px-4 py-3 border-b border-cream-100 last:border-0` |
| Username `<span>` | `text-sm font-medium text-sage-900` |
| Share button | `btn-secondary` |
| Remove button | `btn-ghost` |
| In-flight button (disabled) | `btn-secondary` or `btn-ghost` with `disabled` attribute (`.disabled:opacity-60` applies via `index.css`) |
| Loading text | `text-sage-500 text-sm text-center py-8` |
| Empty text | `text-sage-500 text-sm text-center py-8` |
| No-filter-match text | `text-sage-400 text-sm text-center py-4` |
| Error text | `text-terracotta-600 text-sm text-center py-4` |
| Try again button | `btn-secondary mt-2` |

No new colors. No new `@layer components` classes required.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Backdrop `<div>` | `role="dialog"` + `aria-modal="true"` + `aria-labelledby="share-modal-title"` |
| Modal title `<h2>` | `id="share-modal-title"` — referenced by `aria-labelledby` above |
| Close × `<button>` | `type="button"` + `aria-label="Close share modal"` |
| Filter `<input>` | `aria-label="Filter friends"` or `<label>` — no visible label is shown so `aria-label` is required |
| Share/Remove `<button>` per row | Visible text is sufficient (`"Share"` / `"Remove"`); add `aria-label="Share with @alice"` / `"Remove access for @alice"` to disambiguate when multiple rows exist |
| In-flight `<button>` | `disabled` attribute + `aria-busy="true"` |
| Focus on open | On mount (when `isOpen` becomes `true`), move focus to the filter input using a `ref`. This prevents the user's focus from being lost behind the overlay. |
| Focus trap | Tab/Shift-Tab must cycle within the modal panel only. Implement with a `useEffect` that captures `keydown` on the panel and wraps focus at the boundaries. |
| Restore focus on close | On unmount (when `isOpen` becomes `false`), return focus to the element that opened the modal (the "Share" button in `RecipeDetailPage`). Store the trigger element in a `ref` before opening. |

---

## Integration: RecipeDetailPage

### What changes in RecipeDetailPage

```jsx
// Add to state
const [shareOpen, setShareOpen] = useState(false);

// Add "Share" button to the top-bar action group alongside Edit and Delete
<div className="flex gap-2">
  <Link to={`/recipes/${id}/edit`} className="btn-secondary no-underline">Edit</Link>
  <button onClick={() => setShareOpen(true)} className="btn-secondary">Share</button>
  <ConfirmDialog ... />   {/* replaces the current Delete button after BUG-005 fix */}
</div>

// Add ShareModal below the page content (outside the main layout flow)
{recipe && (
  <ShareModal
    recipeId={id}
    recipeTitle={recipe.title}
    sharedWith={recipe.sharedWith ?? []}
    isOpen={shareOpen}
    onClose={() => setShareOpen(false)}
  />
)}
```

`recipe.sharedWith` will be `undefined` on the current schema — the `?? []` guard ensures no crash while the backend migration is pending.

### Ordering relative to other RecipeDetailPage changes

| Change | Prerequisite |
|--------|-------------|
| BUG-005 fix (ConfirmDialog) | None — can be done now |
| ShareModal "Share" button | Friends feature complete + `recipe.sharedWith` returned by API |
| ShareModal full functionality | All planned share endpoints live |

The "Share" button can be added to the UI with `disabled` state and a tooltip "Coming soon" before the backend is ready, if desired, but this is optional.

---

## Test cases

File: `frontend/src/components/__tests__/ShareModal.test.jsx`

### Mock setup

```jsx
vi.mock('../../api/usersApi', () => ({
  getFriends: vi.fn(),
}));
vi.mock('../../api/recipesApi', () => ({
  shareRecipe:   vi.fn(),
  unshareRecipe: vi.fn(),
}));
vi.mock('../../hooks/useToast', () => ({
  default: () => ({ showToast: vi.fn() }),
}));
```

Wrap renders in a minimal `ToastProvider` or use the mock above. No `MemoryRouter` needed — `ShareModal` has no `<Link>` or router hooks.

### Tests

| # | Test | What to assert |
|---|------|----------------|
| 1 | Returns null when `isOpen` is `false` | `container` is empty; `getFriends` not called |
| 2 | Renders modal when `isOpen` is `true` | Modal panel present in DOM |
| 3 | Calls `getFriends` on open | `getFriends` called once when `isOpen` switches to `true` |
| 4 | Shows loading state while fetching | `"Loading friends…"` text present before `getFriends` resolves |
| 5 | Renders friends list on success | After `getFriends` resolves with `[{ _id: '1', username: 'alice' }]`, `getByText('@alice')` present |
| 6 | Shows empty state when friends list is empty | `getFriends` resolves `[]` → empty-state text shown |
| 7 | Shows error state when fetch fails | `getFriends` rejects → error text + "Try again" button shown |
| 8 | "Try again" re-calls `getFriends` | Click "Try again" → `getFriends` called a second time |
| 9 | Filter input narrows friends list | Type `"al"` → only `@alice` shown, not `@bob` |
| 10 | Filter with no match shows no-match message | Type `"xyz"` → `"No friends match"` text present |
| 11 | Friend not in `sharedWith` shows "Share" button | `sharedWith: []` → `getByRole('button', { name: 'Share with @alice' })` |
| 12 | Friend in `sharedWith` shows "Remove" button | `sharedWith: ['1']` → `getByRole('button', { name: 'Remove access for @alice' })` |
| 13 | Clicking "Share" calls `shareRecipe` with correct args | Click Share → `shareRecipe` called with `(recipeId, '1')` |
| 14 | Successful share updates button to "Remove" | After `shareRecipe` resolves → button changes to "Remove" |
| 15 | Successful share shows success toast | `showToast` called with `('Recipe shared with @alice.', 'success')` |
| 16 | Failed share shows error toast and reverts button | `shareRecipe` rejects → button stays "Share"; `showToast` called with `('error')` variant |
| 17 | Clicking "Remove" calls `unshareRecipe` with correct args | Click Remove → `unshareRecipe` called with `(recipeId, '1')` |
| 18 | Successful unshare updates button to "Share" | After `unshareRecipe` resolves → button changes to "Share" |
| 19 | Row button is disabled while request is in-flight | During pending → button has `disabled` attribute |
| 20 | Clicking × calls `onClose` | `onClose` mock called once |
| 21 | Pressing Escape calls `onClose` | Fire `keydown` with `key: 'Escape'` on modal panel → `onClose` called |
| 22 | Clicking backdrop calls `onClose` | Click backdrop element → `onClose` called |
| 23 | Clicking modal panel does not call `onClose` | Click inside modal panel → `onClose` not called |
| 24 | Filter input has accessible label | `getByRole('textbox', { name: 'Filter friends' })` resolves |
| 25 | Modal has `role="dialog"` and `aria-modal="true"` | DOM assertions on the panel element |
| 26 | Close button is accessible | `getByRole('button', { name: 'Close share modal' })` resolves |
