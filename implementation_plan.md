# Implementation Plan: Dedicated Session Registry (`vs_user_sessions`) & Active Device Management

## 1. Executive Summary & Core Objective

Transition VoSync from a single shared user-level `session_epoch` timestamp to an enterprise-grade, multi-session architecture using a dedicated Directus collection (`vs_user_sessions`). 

This architecture guarantees:
1. **Multi-profile & Multi-device Isolation**: Each browser profile, physical device, and deployment (Local `msi-lo.tail054015.ts.net` vs Ubuntu `ubuntuserver1.tail054015.ts.net`) maintains an independent session lifecycle.
2. **Granular Session Revocation**: Logging out in one profile/device only invalidates that specific session.
3. **Active Device Sessions Management**: Live UI in Settings displaying real authenticated sessions with individual revocation and "Log out all other devices" controls.
4. **Password Change Choice B Flow**: Dialog during password update allowing users to revoke all other sessions while staying signed in on their current device.

---

## 2. Database Schema: `vs_user_sessions`

A new collection in Directus (`vs_user_sessions`) linked to `vs_user`:

| Field Name | Type | Properties / Constraints | Description |
|---|---|---|---|
| `session_id` | UUID / String | Primary Key, Unique | Unique identifier for each session |
| `user_id` | Integer | Foreign key to `vs_user.user_id`, Indexed | Owner of the session |
| `session_token_hash` | String | Nullable | Optional revocation hash |
| `deployment_id` | String | e.g. `msi-lo` vs `ubuntuserver1` | Identifies deployment / host origin |
| `device_name` | String | e.g. "Windows PC", "MacBook Pro", "iPhone 15" | Human-readable device label from UA |
| `device_type` | String | "desktop", "mobile", "tablet" | Device classification |
| `browser_name` | String | e.g. "Google Chrome", "Mozilla Firefox", "Safari" | Browser family |
| `ip_address` | String | IPv4 / IPv6 | Server-observed client IP |
| `location_label` | String | e.g. "Manila, Philippines" | Geo-resolved location description |
| `created_at` | DateTime | Local PH Time (UTC+8 per VoSync rule) | Session creation timestamp |
| `last_activity_at` | DateTime | Local PH Time (UTC+8) | Last observed activity |
| `expires_at` | DateTime | Local PH Time (UTC+8, default +7 days) | Expiration cutoff |
| `revoked_at` | DateTime | Nullable, Local PH Time (UTC+8) | Revocation timestamp |
| `revocation_reason` | String | Nullable ("LOGOUT", "PASSWORD_RESET", "REVOKE_OTHER", "ADMIN") | Reason for session termination |

---

## 3. End-to-End Authentication Architecture

### 3.1 Session Creation at Login
1. Client logs in via `/api/auth/login` or OAuth callback.
2. Server extracts:
   - Request Host (`req.headers.get("host")`) → `deployment_id`
   - User-Agent → parsed into `device_name`, `device_type`, `browser_name`
   - Client IP → resolved via `extractClientIp()` and `resolveIpGeo()`
3. Creates a record in `vs_user_sessions`:
   - `session_id = crypto.randomUUID()`
   - `expires_at = now + 7 days`
4. Injects `sid: session_id` into the JWT claims signed by `issueAuthSession`.
5. Attaches the `vos_sync_access_token` HttpOnly cookie.

### 3.2 Request Verification in Middleware (`src/middleware.ts`)
1. Decodes and verifies the JWT.
2. Extracts `payload.sid` and `payload.sub` (userId).
3. If `sid` is present:
   - Validates that `vs_user_sessions` has the record, `revoked_at` is null, and `expires_at > now`.
   - Rejects revoked or expired sessions immediately with redirect to `/login`.
4. If `sid` is absent (legacy in-flight tokens during migration):
   - Gracefully falls back to the existing `session_epoch` check so active users are not logged out mid-transition.

### 3.3 Individual Logout (`/api/auth/logout`)
1. Reads `sid` from the user's incoming JWT token.
2. Performs `PATCH /items/vs_user_sessions/${sid}`:
   - `revoked_at: getPHTimeString()`
   - `revocation_reason: "LOGOUT"`
3. Evicts the `vos_sync_access_token` cookie on the response.
4. **Leaves all other session records untouched**. Other profiles, devices, and deployments remain fully authenticated.

### 3.4 Password Change with Choice B Dialog
1. User enters current password and new password in Settings.
2. On submit, before sending API request, opens a confirmation Dialog:
   - **Dialog Title**: *"Log Out of Other Devices?"*
   - **Description**: *"Would you like to sign out of all other devices and browser sessions? You will stay logged in on this device."*
   - **Action 1 (Choice B)**: *"Log Out Other Devices"*
     - Updates password.
     - Revokes all active sessions for `user_id` where `session_id != currentSid` with `revocation_reason: "PASSWORD_RESET"`.
     - Current session (`currentSid`) remains active and uninterrupted.
   - **Action 2**: *"Keep Other Devices Logged In"*
     - Updates password.
     - Leaves all active sessions untouched.
   - **Action 3**: *"Cancel"*
     - Closes modal without making changes.

### 3.5 Real Active Device Sessions UI & API
- **Endpoint**: `GET /api/freelancer/settings/sessions`
  - Fetches non-revoked sessions from `vs_user_sessions` where `user_id == currentUserId`.
  - Sets `is_current: session.session_id === currentSid`.
  - Returns real devices, deployment tags (Local vs Ubuntu Server), IPs, locations, and timestamps.
- **Endpoint**: `DELETE /api/freelancer/settings/sessions?session_id=<id>`
  - If `session_id === "all-other"`:
    - Revokes all sessions for `user_id` except `currentSid`.
  - If specific `session_id`:
    - Revokes that session. If `session_id === currentSid`, clears cookie and redirects to `/login`.
- **UI (`SecuritySettings.tsx`)**:
  - Replaces hardcoded mock sessions with live database-driven session cards.
  - Adds a `"Log out all other devices"` button below the sessions list.
  - Includes badge: `"This device"`, deployment pill (`Local` or `Production`), and live status.

---

## 4. Implementation Steps Sequence

1. **Directus Collection Provisioning**:
   - Create `vs_user_sessions` collection and configure fields via Directus API with admin static token.
2. **Session Repository (`src/modules/auth/sessions/session.repo.ts`)**:
   - `createSession(data)`
   - `getSessionById(sessionId)`
   - `revokeSession(sessionId, reason)`
   - `revokeOtherSessions(userId, keepSessionId, reason)`
   - `getActiveSessionsForUser(userId)`
3. **Auth Service & JWT Token Update**:
   - In `loginUser` / `issueAuthSession`, generate `sid`, persist session, and embed `sid` in the JWT payload.
4. **Middleware Session Validation**:
   - Verify `sid` against `vs_user_sessions` with in-memory caching (e.g. short TTL or status-validator cache) for performance.
5. **Logout Route Update**:
   - Revoke only `sid` in `src/app/api/auth/logout/route.ts`.
6. **Password Change & Dialog Integration**:
   - Update `PATCH /api/client/settings` to support `revoke_other_sessions`.
   - Add Radix Dialog in `SecuritySettings.tsx`.
7. **Active Sessions API & UI**:
   - Wire `GET` and `DELETE` in `/api/freelancer/settings/sessions` to the real repository.
   - Update `SecuritySettings.tsx` to display real active sessions, deployment tags, and "Log out all other devices" button.

---

## 5. Verification & Testing Strategy

- **Test 1: Multi-profile isolation on same machine**:
  - Login on Chrome Profile 1 and Chrome Profile 2.
  - Log out on Profile 1. Verify Profile 2 remains logged in.
- **Test 2: Cross-deployment isolation**:
  - Login on Localhost / Tailscale Local (`msi-lo`).
  - Login on Ubuntu (`ubuntuserver1`).
  - Log out on Local. Verify Ubuntu session is active.
- **Test 3: Password change with Choice B**:
  - Change password and choose "Log Out Other Devices".
  - Verify current profile continues working.
  - Verify other profile is kicked to `/login` on next request.
- **Test 4: Active sessions revocation from UI**:
  - Revoke a specific remote session from the UI list.
  - Verify that specific remote session is invalidated immediately.
