# NavBar

## Purpose
Persistent top navigation bar rendered on every protected page — provides app branding, primary navigation links, the current user's username, and a logout action.

---

## Files
- MODIFY `frontend/src/components/NavBar.jsx` — fix BUG-001 (username display)

> No new file is created. NavBar already exists and is partially working.

---

## Props
None. NavBar takes no props. All data comes from `useAuth()`.

---

## Dependencies
| Import | From | Why |
|--------|------|-----|
| `Link`, `useNavigate` | `react-router-dom` | Navigation links + post-logout redirect |
| `useAuth` | `../hooks/useAuth` | Read `user.username` and call `logout()` |

No API calls are made directly by NavBar. Auth state is provided by `AuthContext` via `useAuth`.

---

## Signatures & Data Types

### Component

```js
/**
 * Persistent navigation bar rendered on every protected page.
 * Reads auth state from AuthContext via useAuth(). Takes no props.
 * @returns {JSX.Element}
 */
export default function NavBar(): JSX.Element
```

### Internal functions

```js
/**
 * Logs the user out and redirects to the login page.
 * Awaits logout() so the backend POST /api/auth/logout call completes
 * (cookie cleared, refreshToken nulled in DB) before navigation fires.
 * @returns {Promise<void>}
 */
async function handleLogout(): Promise<void>
```

### Data types consumed

These are the shapes NavBar reads. They originate in `AuthContext` — NavBar never constructs or mutates them.

```ts
/**
 * The authenticated user object stored in AuthContext state.
 * Populated from the login/register response body, or after a
 * successful GET /api/users/me call (BUG-001 fix).
 */
type AuthUser = {
  id: string;        // MongoDB ObjectId serialised as a hex string
  username: string;  // Displayed in the nav — must not be undefined after BUG-001 fix
  email: string;     // Present on the object but not read by NavBar
}

/**
 * The slice of useAuth()'s return value that NavBar uses.
 * useAuth() returns additional fields (login, register, loading)
 * that NavBar does not destructure and must not depend on.
 */
type NavBarAuthSlice = {
  user: AuthUser | null;      // null only before session restore completes —
                              // NavBar is inside ProtectedRoute so null is
                              // not expected in practice, but must not crash
  logout: () => Promise<void>; // Calls POST /api/auth/logout, clears cookie,
                               // clears tokenRef and user state in AuthContext
}
```

### Data types produced

NavBar produces no data. It renders JSX and triggers navigation as a side-effect of `handleLogout`.

---

## States

### 1. Authenticated — username known
- Username is displayed verbatim: `user.username` (e.g., "alice")
- All nav links and logout button are visible

### 2. Authenticated — username unknown (BUG-001)
- `user` exists but `user.username` is `undefined`
- Currently falls back to the string `"Account"` — this is the broken state
- **After fix:** this state must not be reachable. `AuthContext` must populate `username` before NavBar renders

### 3. Not rendered
- NavBar is only mounted inside `ProtectedRoute`, so it is never shown to unauthenticated users. No unauthenticated state to handle here.

---

## Behavior

| Interaction | Result |
|-------------|--------|
| Click "🍳 Recipe App" logo | Navigate to `/recipes` |
| Click "My Recipes" | Navigate to `/recipes` |
| Click "+ New Recipe" | Navigate to `/recipes/new` |
| Click "Logout" | Call `await logout()` (via `useAuth`), then `navigate('/login')` |

- Logout is async — `await` must be preserved so the backend call (`POST /api/auth/logout`) completes before the redirect
- No loading state is shown during logout; the redirect is instant from the user's perspective

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  🍳 Recipe App          My Recipes   + New Recipe   alice  Logout│
└─────────────────────────────────────────────────────────────────┘
```

- Full-width, sticky, `z-50`, `shadow-md`
- Logo left-aligned
- All other items right-aligned in a flex row with `gap-6`
- Height driven by `py-3`

---

## Design tokens used

| Element | Classes |
|---------|---------|
| `<nav>` wrapper | `bg-sage-800 px-6 py-3 flex items-center justify-between sticky top-0 z-50 shadow-md` |
| Logo link | `text-cream-100 font-bold text-lg tracking-wide hover:text-white transition-colors` |
| "My Recipes" link | `text-cream-300 hover:text-cream-100 text-sm font-medium transition-colors` |
| "+ New Recipe" link | `bg-terracotta-500 hover:bg-terracotta-600 text-white text-sm font-semibold px-4 py-1.5 rounded shadow-sm transition-colors` |
| Username `<span>` | `text-cream-400 text-sm font-medium` |
| Logout `<button>` | `border border-sage-600 text-cream-300 hover:bg-sage-700 hover:text-cream-100 px-3 py-1.5 rounded text-sm font-medium transition-colors shadow-sm cursor-pointer` |

> Note: "+ New Recipe" and Logout do not use `.btn-primary` / `.btn-ghost` because they are styled for a dark nav background, not the light page surface those classes target. Do not replace them with the standard button classes.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Logout `<button>` | Visible text "Logout" is sufficient — no additional `aria-label` needed |
| `<nav>` element | The semantic `<nav>` element provides the landmark role automatically |
| Links | All `<Link>` elements have visible text — no `aria-label` needed |

No additional ARIA attributes are required for this component.

---

## Related bugs

### BUG-001 — Username shows "Account" after session restore
**Where:** `AuthContext.jsx` (root cause), `NavBar.jsx:36` (symptom)

**Problem:** On mount, `AuthContext` calls `GET /api/auth/refresh`, which returns only a new `accessToken`. The JWT payload contains only `userId`. There is no `username` in the token, so `user.username` is `undefined` when NavBar renders after a page refresh.

**Fix (option b — recommended in system_design.md):**
After a successful refresh call, `AuthContext` must call `GET /api/users/me` to fetch the full user profile and populate `user.username` in state.

This fix is implemented in `AuthContext.jsx`, not in `NavBar.jsx` itself. NavBar only reads `user?.username` — it should not change. The fix belongs in `AuthContext`.

**Prerequisite:** `GET /api/users/me` backend endpoint must exist (see `system_design.md §10.1`). If it does not yet exist, this fix cannot be completed — flag this dependency rather than working around it.

---

## Test cases

File: `frontend/src/components/__tests__/NavBar.test.jsx`

Mock setup required:
```jsx
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: { username: 'alice' }, logout: vi.fn() })
}));
```
Wrap all renders in `<MemoryRouter>`.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing | No thrown errors |
| 2 | Displays username from `user.username` | `screen.getByText('alice')` is present |
| 3 | Falls back gracefully when `user.username` is undefined | After BUG-001 fix this state should not occur, but: if `user` is `{ username: undefined }`, the component must not crash and must not display `"undefined"` |
| 4 | Logo link points to `/recipes` | `getByText('🍳 Recipe App').closest('a')` has `href="/recipes"` |
| 5 | "My Recipes" link points to `/recipes` | `getByText('My Recipes').closest('a')` has `href="/recipes"` |
| 6 | "+ New Recipe" link points to `/recipes/new` | `getByText('+ New Recipe').closest('a')` has `href="/recipes/new"` |
| 7 | Logout button calls `logout()` and navigates to `/login` | Click "Logout" → `logout` mock called once → `navigate` called with `'/login'` |
| 8 | Logout button is accessible | `getByRole('button', { name: 'Logout' })` resolves |
