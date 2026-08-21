# Review Report: Milestone 1 — URSA Authentication & Session Proxy

**Reviewer**: Reviewer 1 (Adversarial Critic & Quality Reviewer)
**Target Milestone**: Milestone 1 (URSA Authentication & Session Proxy)
**Target Files**:
- `src/types/ursa.ts`
- `src/lib/ursa/sessionStore.ts`
- `src/lib/ursa/decoder.ts`
- `src/lib/ursa/client.ts`
- `src/app/api/auth/login/route.ts`
- `src/app/api/auth/status/route.ts`
- `src/app/api/auth/logout/route.ts`

---

## 1. Review Summary

**Verdict**: **`APPROVE`**

The implementation of Milestone 1 satisfies all functional, architectural, security, and interface requirements outlined in `PROJECT.md` and `ORIGINAL_REQUEST.md`. The code demonstrates excellent attention to detail, handling real ColdFusion session negotiation, multi-hop redirect tracking, cookie jar accumulation, Windows-874 Thai character decoding, secure token generation, and robust HTTP-only cookie lifecycle management. No integrity violations or dummy/facade implementations were detected.

---

## 2. Integrity & Forensic Audit

| Check Category | Evaluation | Result |
|---|---|---|
| **Hardcoded Test Results** | Source code inspected for hardcoded credentials or mock outputs. None present. | **PASS** |
| **Dummy / Facade Implementations** | Real network fetch requests to `https://ursa2.bu.ac.th/SetFullId.cfm` and `/seat/seat1.cfm`. | **PASS** |
| **Bypassed Logic / Shortcuts** | Genuine multi-step cookie handshake, redirect tracking, and Windows-874 binary decoding. | **PASS** |
| **Self-Certifying / Fabricated Logs** | Verified all logic directly in source code. | **PASS** |

---

## 3. Detailed Quality & Security Review

### 3.1 Correctness & Architecture Conformance
- **`src/types/ursa.ts`**:
  - Clean TypeScript definitions for credentials, sessions, responses, profile models, and section query requests/responses.
  - Complete types exported for downstream milestones (M2 Profile, M3 Sections, M4 Frontend).
- **`src/lib/ursa/sessionStore.ts`**:
  - Generates 256-bit cryptographically secure base64url session tokens using `crypto.randomBytes(32).toString('base64url')`.
  - Preserves session store across development HMR via `globalThis.ursaSessions`.
  - Implements 1-hour TTL (`SESSION_TTL_MS = 3,600,000`).
  - Active lazy expiration on `getSession()` plus eager sweep on `createSession()` to prevent memory leaks in long-running Node processes.
- **`src/lib/ursa/decoder.ts`**:
  - `decodeWindows874` uses standard `TextDecoder('windows-874', { fatal: false })` with cascading fallback to `utf-8` and `latin1`.
  - `decodeUrsaResponse` handles `ArrayBuffer` conversion from `Response` body for Thai character encoding preservation.
- **`src/lib/ursa/client.ts`**:
  - Upstream URL configured to `https://ursa2.bu.ac.th`.
  - Performs initial GET pre-flight request to `/seat/seat1.cfm` to seed ColdFusion cookies (`CFID`, `CFTOKEN`).
  - Submits POST to `/SetFullId.cfm` with URL-encoded parameters (`liveid`, `inter_passwd`, `option1` where 1=regular, 2=buic).
  - Merges cookies at each step using a key-deduplicated `Map`.
  - Follows up to 5 30x HTTP redirects (`MAX_REDIRECT_HOPS = 5`), passing accumulated cookies and updating cookie jar.
  - Checks for upstream rejection strings via `/Access Denied|User name.*Password/i`.
  - Exports `fetchUrsa()` helper for downstream API routes.
- **`src/app/api/auth/login/route.ts`**:
  - Validates request body, returns 400 for empty or malformed inputs.
  - Invokes `loginUrsa()`, creates session token, sets HTTP-only cookie with:
    - `HttpOnly: true` (XSS protection)
    - `SameSite: 'strict'` (CSRF protection)
    - `Path: '/'`
    - `MaxAge: 3600` (1 hour)
    - `Secure: process.env.NODE_ENV === 'production'`
  - Returns `{ ok: true, connected: true }` on success (200).
  - Returns 401 with Thai error message on invalid credentials.
  - Returns 502 with Thai error message on upstream network error.
- **`src/app/api/auth/status/route.ts`**:
  - Reads `buplaner_session` cookie, verifies active session, returns `{ connected: boolean }`.
  - Sets `Cache-Control: 'no-store, max-age=0'` to prevent browser caching of authentication status.
- **`src/app/api/auth/logout/route.ts`**:
  - Purges session from memory store and sets `Max-Age: 0` on `buplaner_session` cookie.
  - Supports both `POST` and `GET` methods.

---

## 4. Adversarial Stress-Testing & Attack Surface Analysis

| Stress Scenario | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|
| **Invalid JSON Body in `/api/auth/login`** | Return 400 with `{ error: 'Invalid JSON payload' }` | Caught by `try/catch` on `request.json()` -> returns 400 | **PASS** |
| **Empty / Whitespace Credentials** | Return 400 without contacting upstream | Guard `!username.trim() \|\| !password` returns 400 | **PASS** |
| **Upstream Infinite Redirect Loop** | Terminate and prevent hung worker | Bounded by `hop < MAX_REDIRECT_HOPS` (5 hops max) | **PASS** |
| **Relative vs Absolute Redirect Location** | Correct URL resolution | `new URL(location, URSA_BASE_URL)` correctly handles both | **PASS** |
| **Duplicate / Overwriting Set-Cookie Headers** | Cookies properly merged and deduplicated | `mergeCookies` splits and indexes by cookie key | **PASS** |
| **Cookie Values containing `=` signs** | Value not truncated | `[key, ...val]` with `val.join('=')` preserves `=` in values | **PASS** |
| **Expired Session Lookup** | Cleanly return `null` and remove from map | `getSession` checks `now - session.createdAt > SESSION_TTL_MS` | **PASS** |
| **XSS Cookie Theft Vector** | Session token inaccessible to JS | `httpOnly: true` prevents `document.cookie` access | **PASS** |
| **CSRF Vector** | Token not sent on cross-site requests | `sameSite: 'strict'` prevents cross-site inclusion | **PASS** |

---

## 5. Verified Interface Contracts

- `POST /api/auth/login` -> Request `{ username, password, program? }` -> Response `{ ok: true, connected: true }` + `Set-Cookie: buplaner_session=...; HttpOnly; SameSite=Strict; Max-Age=3600; Path=/` (Verified)
- `GET /api/auth/status` -> Response `{ connected: boolean }` + `Cache-Control: no-store, max-age=0` (Verified)
- `POST /api/auth/logout` -> Response `{ ok: true, connected: false }` + `Set-Cookie: buplaner_session=; Path=/; Max-Age=0` (Verified)

---

## 6. Findings Summary

No critical, major, or minor blocking defects found. The implementation is robust, adheres to Next.js App Router conventions, and fulfills Milestone 1 requirements completely.
