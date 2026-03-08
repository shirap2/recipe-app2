# FriendCard

## Purpose
Displays a single user in the context of the friends system — showing their username and relationship status, with inline actions to accept/decline a pending request or unfriend a confirmed friend.

---

## Files
- CREATE `frontend/src/components/FriendCard.jsx`
- USED BY `frontend/src/pages/FriendsPage.jsx` (planned)

---

## Props

| Prop | Type | Required | Default | Description |
|------|------|----------|---------|-------------|
| `user` | `FriendUser` | Yes | — | The user being displayed. Shape: `{ _id: string, username: string }`. |
| `status` | `'friend' \| 'incoming' \| 'outgoing'` | Yes | — | Relationship status. Determines which actions are shown. See States. |
| `onUnfriend` | `(userId: string) => void \| Promise<void>` | No | — | Required when `status = 'friend'`. Called with `user._id` when the user confirms unfriend. |
| `onAccept` | `(userId: string) => void \| Promise<void>` | No | — | Required when `status = 'incoming'`. Called with `user._id` when the user clicks Accept. |
| `onDecline` | `(userId: string) => void \| Promise<void>` | No | — | Required when `status = 'incoming'`. Called with `user._id` when the user clicks Decline. |

**Invariants (enforced by the parent, not by FriendCard itself):**
- When `status = 'friend'`, `onUnfriend` must be provided.
- When `status = 'incoming'`, both `onAccept` and `onDecline` must be provided.
- When `status = 'outgoing'`, no action callbacks are needed — the card is display-only.

---

## Dependencies

| Import | From | Why |
|--------|------|-----|
| `ConfirmDialog` | `./ConfirmDialog` | Inline unfriend confirmation — replaces any `window.confirm` for the unfriend action |

No router, no API calls, no context. FriendCard is a pure UI component — all API calls are made by the parent (`FriendsPage`) and passed in as callbacks.

**Prerequisite:** `ConfirmDialog` must exist before FriendCard can be implemented. See `design/components/ConfirmDialog.md`.

---

## Signatures & Data Types

### Component

```js
/**
 * Displays a single user in the context of the friends system.
 * Renders their username, a status badge, and context-appropriate actions.
 * All async operations are delegated to parent callbacks.
 *
 * @param {FriendCardProps} props
 * @returns {JSX.Element}
 */
export default function FriendCard(props: FriendCardProps): JSX.Element
```

### Props type

```ts
type FriendUser = {
  _id:      string;   // MongoDB ObjectId as hex string
  username: string;   // Displayed verbatim
}

type FriendCardProps = {
  user:        FriendUser;
  status:      'friend' | 'incoming' | 'outgoing';
  onUnfriend?: (userId: string) => void | Promise<void>;
  onAccept?:   (userId: string) => void | Promise<void>;
  onDecline?:  (userId: string) => void | Promise<void>;
}
```

### Data types produced

FriendCard produces no data. It calls the parent callbacks as side effects and renders JSX.

---

## States

### 1. Confirmed friend (`status = 'friend'`)

The user is in the current user's friends list.

- Username displayed
- "Friends" status badge (sage green)
- "Unfriend" action via `ConfirmDialog` (uses `btn-ghost` trigger, expands inline to confirm)

```
┌──────────────────────────────────────────────────┐
│  alice                           [Friends]        │
│                                  [Unfriend]       │
└──────────────────────────────────────────────────┘
```

### 2. Incoming pending request (`status = 'incoming'`)

Another user has sent a friend request to the current user. The current user must accept or decline.

- Username displayed
- "Wants to be friends" label (no badge — plain text is sufficient)
- "Accept" button (`btn-primary`)
- "Decline" button (`btn-ghost`)

```
┌──────────────────────────────────────────────────┐
│  bob                                              │
│  Wants to be friends       [Accept]  [Decline]   │
└──────────────────────────────────────────────────┘
```

### 3. Outgoing pending request (`status = 'outgoing'`)

The current user has sent a friend request and is awaiting the other user's response. No actions are available — the card is display-only.

- Username displayed
- "Request sent" status badge (muted cream/sage)

```
┌──────────────────────────────────────────────────┐
│  carol                      [Request sent]        │
└──────────────────────────────────────────────────┘
```

---

## Behavior

| Trigger | Action |
|---------|--------|
| Click "Unfriend" trigger | `ConfirmDialog` switches to pending state — shows confirmation message |
| Confirm unfriend | `onUnfriend(user._id)` called; `ConfirmDialog` resets to resting state |
| Cancel unfriend | `ConfirmDialog` resets to resting state; `onUnfriend` not called |
| Click "Accept" | `onAccept(user._id)` called immediately — no confirmation needed |
| Click "Decline" | `onDecline(user._id)` called immediately — no confirmation needed |
| `status = 'outgoing'` | No interactive elements; card is purely informational |

**FriendCard does not:**
- Remove itself from the list after an action — the parent is responsible for updating the list
- Show a loading spinner during async callbacks — the parent is responsible for loading feedback
- Handle errors from callbacks — errors propagate to the parent

---

## Layout

### Confirmed friend

```
┌──────────────────────────────────────────────────────┐
│  [username]                        [Friends badge]    │
│                                    [Unfriend button]  │
└──────────────────────────────────────────────────────┘
```

- `.card` wrapper with `p-4`
- Flex row: username left-aligned, badge + action right-aligned in a flex column (`items-end gap-2`)
- Username: `text-sage-900 font-semibold text-sm`

### Incoming request

```
┌──────────────────────────────────────────────────────┐
│  [username]                                           │
│  Wants to be friends          [Accept]  [Decline]    │
└──────────────────────────────────────────────────────┘
```

- `.card` wrapper with `p-4`
- Username row at top
- Second row: descriptive text left-aligned, buttons right-aligned — flex row `justify-between items-center mt-3`

### Outgoing request

```
┌──────────────────────────────────────────────────────┐
│  [username]                    [Request sent badge]   │
└──────────────────────────────────────────────────────┘
```

- `.card` wrapper with `p-4`
- Flex row: username left-aligned, badge right-aligned

---

## Integration: FriendsPage usage

`FriendsPage` (planned) will render three sections, each mapping over a list of users with the appropriate `status`:

```jsx
{/* Confirmed friends */}
{friends.map(u => (
  <FriendCard
    key={u._id}
    user={u}
    status="friend"
    onUnfriend={handleUnfriend}
  />
))}

{/* Incoming requests */}
{incomingRequests.map(u => (
  <FriendCard
    key={u._id}
    user={u}
    status="incoming"
    onAccept={handleAccept}
    onDecline={handleDecline}
  />
))}

{/* Outgoing requests */}
{outgoingRequests.map(u => (
  <FriendCard
    key={u._id}
    user={u}
    status="outgoing"
  />
))}
```

The callbacks in `FriendsPage` call the relevant API endpoints and then update list state:

```js
// PATCH /api/users/friends/request/:userId  { action: 'accept' }
const handleAccept  = async (userId) => { await acceptRequest(userId);  refetchLists(); };

// PATCH /api/users/friends/request/:userId  { action: 'decline' }
const handleDecline = async (userId) => { await declineRequest(userId); refetchLists(); };

// DELETE /api/users/friends/:userId
const handleUnfriend = async (userId) => { await unfriend(userId);      refetchLists(); };
```

---

## Design tokens used

| Element | Classes |
|---------|---------|
| Card wrapper | `.card p-4` |
| Username | `text-sage-900 font-semibold text-sm` |
| "Friends" badge | `bg-sage-100 text-sage-700 text-xs font-semibold px-2 py-0.5 rounded` |
| "Request sent" badge | `bg-cream-200 text-sage-500 text-xs font-semibold px-2 py-0.5 rounded` |
| "Wants to be friends" label | `text-sage-500 text-xs` |
| Accept button | `.btn-primary` (small — `px-3 py-1 text-xs`) |
| Decline button | `.btn-ghost` (small — `px-3 py-1 text-xs`) |
| Unfriend trigger (via ConfirmDialog) | `.btn-ghost` (small — `px-3 py-1 text-xs`) |
| Unfriend confirm (via ConfirmDialog) | `.btn-danger` |

No new colors. No inline styles.

> Note: Accept, Decline, and Unfriend buttons are intentionally small. The standard `.btn-*` classes use `px-5 py-2`. For FriendCard, override with `px-3 py-1 text-xs` to keep the card compact. Do not create a new button class — pass additional classes alongside the base class, or apply the sizing via a wrapping `<span className="text-xs">`.

---

## Accessibility

| Element | Requirement |
|---------|-------------|
| Accept button | `type="button"`, visible text "Accept" — sufficient |
| Decline button | `type="button"`, visible text "Decline" — sufficient |
| Unfriend trigger | `type="button"` (provided by `ConfirmDialog`) — sufficient |
| Username | Plain text in a `<p>` or `<span>` — no ARIA role needed |
| Status badges | Decorative — no `role` or `aria-label` needed; they duplicate visible text |

Each card is not a landmark — no `role="article"` is required here. FriendsPage can use `<ul>` / `<li>` wrappers for the list structure if needed for semantics.

---

## Related features

### Friends / social system (system_design.md §10.4)
FriendCard is part of the friends feature. Implementation order:

1. Backend: add `friends` + `friendRequests` to User schema, add users routes
2. Frontend: `usersApi.js` — `getFriends`, `getIncomingRequests`, `sendFriendRequest`, `respondToRequest`, `unfriend`
3. Frontend: `FriendCard.jsx` (this component)
4. Frontend: `FriendsPage.jsx` — assembles the three lists using FriendCard

**Prerequisite:** `ConfirmDialog` must be implemented before FriendCard (see `design/components/ConfirmDialog.md`).

---

## Test cases

File: `frontend/src/components/__tests__/FriendCard.test.jsx`

Mock setup required:
```jsx
vi.mock('./ConfirmDialog', () => ({
  default: ({ triggerLabel, onConfirm }) => (
    <button onClick={onConfirm}>{triggerLabel}</button>
  )
}));
```

No router or auth context dependency — no `MemoryRouter` wrapper needed.

| # | Test | What to assert |
|---|------|----------------|
| 1 | Renders without crashing — friend | No thrown errors with `status="friend"` and `onUnfriend` provided |
| 2 | Renders without crashing — incoming | No thrown errors with `status="incoming"` and `onAccept` + `onDecline` provided |
| 3 | Renders without crashing — outgoing | No thrown errors with `status="outgoing"` |
| 4 | Displays username in all states | `getByText('alice')` present for each `status` value |
| 5 | Friend state: shows "Friends" badge | `getByText('Friends')` present when `status="friend"` |
| 6 | Friend state: shows Unfriend trigger | `getByRole('button', { name: 'Unfriend' })` present when `status="friend"` |
| 7 | Friend state: confirming unfriend calls `onUnfriend` with `user._id` | Click Unfriend → `onUnfriend` mock called with correct `_id` |
| 8 | Friend state: Accept and Decline buttons are not shown | `queryByRole('button', { name: 'Accept' })` and `queryByRole('button', { name: 'Decline' })` are null |
| 9 | Incoming state: shows "Wants to be friends" label | `getByText('Wants to be friends')` present when `status="incoming"` |
| 10 | Incoming state: Accept button calls `onAccept` with `user._id` | Click Accept → `onAccept` mock called with correct `_id` |
| 11 | Incoming state: Decline button calls `onDecline` with `user._id` | Click Decline → `onDecline` mock called with correct `_id` |
| 12 | Incoming state: Unfriend button is not shown | `queryByRole('button', { name: 'Unfriend' })` is null |
| 13 | Outgoing state: shows "Request sent" badge | `getByText('Request sent')` present when `status="outgoing"` |
| 14 | Outgoing state: no action buttons shown | `queryByRole('button')` returns null — no interactive elements |
| 15 | Accept button is accessible | `getByRole('button', { name: 'Accept' })` resolves |
| 16 | Decline button is accessible | `getByRole('button', { name: 'Decline' })` resolves |
