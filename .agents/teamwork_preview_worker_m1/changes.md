# Milestone 1: URSA Authentication & Session Proxy Changes

## Overview
Implemented the foundational URSA authentication, ColdFusion session cookie negotiation proxy, windows-874 decoder, and Next.js App Router authentication endpoints for the Bangkok University timetable planner application.

## Files Created

### 1. `src/types/ursa.ts`
- **Purpose**: Defines TypeScript interfaces and types for URSA authentication, session data, student profiles, form controls, and section queries.
- **Key Types**:
  - `UrsaProgram`: `'regular' | 'buic'`
  - `UrsaLoginCredentials`: `{ username: string; password: string; program?: UrsaProgram }`
  - `UrsaSession`: `{ cookie: string; createdAt: number }`
  - `UrsaLoginResponse`: `{ ok: boolean; connected?: boolean; error?: string }`
  - `UrsaAuthStatusResponse`: `{ connected: boolean }`
  - `UrsaLogoutResponse`: `{ ok: boolean; connected: boolean }`
  - `UrsaProfile`, `UrsaProfileResponse`, `UrsaFormControl`, `UrsaForm`, `UrsaSectionsResponse`, `UrsaQueryRequest`, `UrsaQueryResponse`.

### 2. `src/lib/ursa/sessionStore.ts`
- **Purpose**: In-memory session store for URSA upstream cookies.
- **Key Features**:
  - `SESSION_COOKIE_NAME = 'buplaner_session'`
  - `SESSION_TTL_MS = 3,600,000` (1 hour)
  - Cryptographically secure 32-byte `base64url` session token generation via `crypto.randomBytes(32).toString('base64url')`.
  - Next.js development hot-reload persistence via `(globalThis as any).ursaSessions`.
  - Methods: `createSession`, `getSession` (with automatic expired deletion), `deleteSession`, `cleanupExpiredSessions`.

### 3. `src/lib/ursa/decoder.ts`
- **Purpose**: Windows-874 / CP874 binary-to-UTF8 decoding.
- **Key Features**:
  - `decodeWindows874(buffer)`: Decodes buffer with `new TextDecoder('windows-874', { fatal: false })`, with graceful fallback to `utf-8` and `latin1`.
  - `decodeUrsaResponse(response)`: Helper to extract `arrayBuffer()` from fetch `Response` and decode Thai text.

### 4. `src/lib/ursa/client.ts`
- **Purpose**: Genuine URSA upstream HTTP client with multi-step handshake and redirect tracking.
- **Key Features**:
  - `URSA_BASE_URL = 'https://ursa2.bu.ac.th'`
  - `URSA_USER_AGENT`: Desktop Chrome User-Agent.
  - `extractUpstreamCookies(response)`: Extracts `Set-Cookie` headers via `getSetCookie()` or `get('set-cookie')`.
  - `mergeCookies(existing, incoming)`: Cookie jar merging and key deduplication.
  - `loginUrsa(credentials)`:
    1. Pre-flight GET `/seat/seat1.cfm` to seed initial `CFID`/`CFTOKEN`.
    2. POST `/SetFullId.cfm` with `liveid`, `inter_passwd`, and `option1` (1 for regular, 2 for buic).
    3. Multi-hop 302 redirect tracking (up to 5 hops), updating cookie jar at each step.
    4. Decodes final body via `decodeUrsaResponse` and checks for rejection pattern `/Access Denied|User name.*Password/i`.
    5. Returns accumulated upstream cookie string.
  - `fetchUrsa(pathOrUrl, sessionCookie, init)`: Helper for proxying authenticated requests to URSA.

### 5. `src/app/api/auth/login/route.ts`
- **Purpose**: API endpoint for user authentication.
- **Method**: `POST`
- **Payload**: `{ username, password, program }`
- **Behavior**: Validates credentials, executes `loginUrsa`, creates session in `sessionStore`, sets HTTP-only `buplaner_session` cookie (SameSite=Strict, Max-Age=3600), and returns `{ ok: true, connected: true }`.
- **Error Handling**:
  - 400 for missing credentials.
  - 401 for upstream credential rejection.
  - 502 for upstream network errors.

### 6. `src/app/api/auth/status/route.ts`
- **Purpose**: API endpoint to verify current connection state.
- **Method**: `GET`
- **Behavior**: Reads `buplaner_session` cookie, verifies valid unexpired session, and returns `{ connected: boolean }` with `Cache-Control: 'no-store, max-age=0'`.

### 7. `src/app/api/auth/logout/route.ts`
- **Purpose**: API endpoint to invalidate session and clear cookie.
- **Method**: `POST` & `GET`
- **Behavior**: Removes session token from `sessionStore`, sets cookie with `Max-Age=0`, and returns `{ ok: true, connected: false }`.
