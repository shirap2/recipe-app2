# ProtectedRoute

## Purpose
Route guard that redirects unauthenticated users to `/login` and wraps authenticated pages with `NavBar` + a `<main>` container.

---

## Files
- No changes needed — component is correctly implemented.
- This design file exists to document the contract so other components and agents understand how ProtectedRoute works.

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `children` | `ReactNode` | Yes | — | The page component to render when the user is authenticated |

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `Navigate` | `react-router-dom` | Redirects to `/login` when unauthenticated |
| `useAuth` | `../hooks/useAuth` | Reads `user` to determine auth state |
| `NavBar` | `./NavBar` | Renders the navigation bar above every protected page |

---

## Signatures & Data Types

### Component

```js
/**
 * Route guard for protected pages.
 * If user is null: redirects to /login (replace — no back-button loop).
 * If user is set: renders NavBar above children inside a <main> wrapper.
 *
 * Loading state is handled upstream by AuthContext, which renders
 * {!loading && children} — ProtectedRoute is never mounted during
 * session restore. It will always see either a resolved user or null.
 *
 * @param {{ children: ReactNode }} props
 * @returns {JSX.Element}
 */
export default function ProtectedRoute({ children }): JSX.Element
```

### Props type

```ts
type ProtectedRouteProps = {
  children: ReactNode;  // The page to render — e.g. <RecipesPage />
}
```

### Auth slice consumed from `useAuth()`

```ts
type ProtectedRouteAuthSlice = {
  user: AuthUser | null;
  // login, logout, register, loading are present but not read by ProtectedRoute
}
```

### Data types produced

None. ProtectedRoute either redirects (produces navigation) or renders its `children` wrapped in layout markup.

---

## States

### 1. Unauthenticated (`user === null`)
Renders `<Navigate to="/login" replace />`. The `replace` flag prevents the login page from being added to the browser history stack, so pressing Back after login does not loop back to the redirect.

The user will never see a flash of the protected page — `AuthContext` holds rendering until session restore completes, so `user` is always definitively `null` or a populated object when ProtectedRoute renders.

### 2. Authenticated (`user` is an `AuthUser` object)
Renders:
```jsx
<>
  <NavBar />
  <main>{children}</main>
</>
```

NavBar is sticky (`position: sticky; top: 0`), so it stays visible as the user scrolls. The `<main>` element provides the page landmark role automatically — no `role` attribute is needed.

---

## Behavior

| Condition | Result |
|-----------|--------|
| `user === null` on render | `<Navigate to="/login" replace />` — immediate redirect |
| `user` is set on render | Renders `<NavBar />` + `<main>{children}</main>` |
| User logs out (user set to null mid-session) | AuthContext sets `user` to null, causing ProtectedRoute to re-render and redirect to `/login` |

ProtectedRoute is stateless and has no side effects. It is a pure conditional render.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  NavBar (sticky)                                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  <main>                                             │
│    {children}   ← page component fills this area   │
│  </main>                                            │
│                                                     │
└─────────────────────────────────────────────────────┘
```

ProtectedRoute applies no padding, max-width, or background to `<main>`. Each page component manages its own layout via the `.page` class.

---

## Design tokens used

None. ProtectedRoute renders only structural HTML (`<>`, `<NavBar />`, `<main>`). All visual styling belongs to NavBar and the page children.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| `<main>` | Provides the `main` landmark role automatically — no `role` attribute needed |
| `<NavBar />` | NavBar's `<nav>` provides the `navigation` landmark — no additional markup needed here |

The combination of `<nav>` (in NavBar) and `<main>` gives every protected page a correct landmark structure out of the box.

---

## Usage in `App.jsx`

```jsx
<Route
  path="/recipes"
  element={<ProtectedRoute><RecipesPage /></ProtectedRoute>}
/>
```

Every protected route wraps its page in `<ProtectedRoute>`. ProtectedRoute is never used for public routes (`/login`, `/register`).

---

## What ProtectedRoute does NOT do

- Does **not** handle `loading` — `AuthContext` suppresses rendering until session restore finishes
- Does **not** show a spinner — the page is blank during session restore (controlled by AuthContext)
- Does **not** accept a `redirectTo` prop — redirect target is always `/login`
- Does **not** render NavBar conditionally — NavBar is always shown when children are rendered

---

## Test cases

File: `frontend/src/components/__tests__/ProtectedRoute.test.jsx`

Mock setup required:
```js
vi.mock('../../hooks/useAuth', () => ({
  default: () => ({ user: null })  // override per test
}));
vi.mock('../NavBar', () => ({ default: () => <div data-testid="navbar" /> }));
```
Wrap all renders in `<MemoryRouter>`.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing when user is null | No thrown errors |
| 2 | Redirects to `/login` when `user` is null | Rendered output contains a redirect to `/login`; children are not rendered |
| 3 | Renders children when `user` is set | `getByText('page content')` is present when user is `{ id: '1', username: 'alice' }` |
| 4 | Renders NavBar when user is set | `getByTestId('navbar')` is present |
| 5 | Does not render NavBar when redirecting | `queryByTestId('navbar')` is null when user is null |
| 6 | Children are wrapped in `<main>` | `getByRole('main')` contains the children |
| 7 | Redirect uses `replace` (no history entry) | Navigating to a protected route as an unauthenticated user leaves the history length unchanged |
