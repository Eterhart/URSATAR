# Handoff Report: Milestone 1 Review

**Agent**: Reviewer 1 (Adversarial Critic & Reviewer)
**Target**: Milestone 1 (URSA Authentication & Session Proxy)
**Handoff Type**: Hard (Review Complete)
**Verdict**: **`APPROVE`**

---

## 1. Observation
Direct source code inspection of all 7 target files was performed:
1. `src/types/ursa.ts` (lines 1–87):
   - Defined `UrsaProgram`, `UrsaLoginCredentials`, `UrsaSession`, `UrsaLoginResponse`, `UrsaAuthStatusResponse`, `UrsaLogoutResponse`, and full data models for M2/M3 (`UrsaProfile`, `UrsaForm`, `UrsaSectionsResponse`, `UrsaQueryRequest`, `UrsaQueryResponse`).
2. `src/lib/ursa/sessionStore.ts` (lines 1–67):
   - `SESSION_COOKIE_NAME = 'buplaner_session'`, `SESSION_TTL_MS = 60 * 60 * 1000` (1 hour).
   - Generates 32-byte cryptographically secure session IDs via `crypto.randomBytes(32).toString('base64url')`.
   - Manages in-memory `sessionMap` with Next.js dev HMR persistence via `(globalThis as any).ursaSessions`.
   - Expiration validation in `getSession()`, `deleteSession()`, and sweep in `cleanupExpiredSessions()`.
3. `src/lib/ursa/decoder.ts` (lines 1–25):
   - `decodeWindows874`: Uses `new TextDecoder('windows-874', { fatal: false })` with fallback to `utf-8` and `latin1`.
   - `decodeUrsaResponse`: Extracts `arrayBuffer()` from fetch `Response` and decodes CP874 bytes to UTF-8.
4. `src/lib/ursa/client.ts` (lines 1–138):
   - `URSA_BASE_URL = 'https://ursa2.bu.ac.th'`, User Agent set to Chrome desktop.
   - `extractUpstreamCookies`: Safely extracts cookies from `getSetCookie()` or `get('set-cookie')`.
   - `mergeCookies`: Merges and deduplicates cookie pairs using `Map<string, string>`.
   - `loginUrsa`:
     - Step 1: Pre-flight landing GET `/seat/seat1.cfm` with `redirect: 'manual'`.
     - Step 2: POST `/SetFullId.cfm` with `liveid`, `inter_passwd`, `option1` (`1` or `2`), and accumulated cookie.
     - Step 3: Loops up to 5 30x redirects (`MAX_REDIRECT_HOPS = 5`), following `location` via `new URL(location, URSA_BASE_URL)`.
     - Step 4: Decodes response and detects credentials failure via `/Access Denied|User name.*Password/i`.
   - `fetchUrsa`: Reusable upstream proxy fetcher.
5. `src/app/api/auth/login/route.ts` (lines 1–69):
   - Validates JSON payload and non-empty strings.
   - Calls `loginUrsa`, creates session, sets HTTP-only cookie with `HttpOnly`, `SameSite: strict`, `Path: /`, `Max-Age: 3600`, `Secure: isProd`.
   - Returns 200 `{ ok: true, connected: true }`, 400 on bad payload, 401 on `URSA_REJECTED_CREDENTIALS`, 502 on upstream network error.
6. `src/app/api/auth/status/route.ts` (lines 1–18):
   - Reads `buplaner_session` cookie, verifies session status, returns `{ connected: boolean }` with `Cache-Control: 'no-store, max-age=0'`.
7. `src/app/api/auth/logout/route.ts` (lines 1–28):
   - Deletes session from store, sets cookie with `Max-Age: 0`, supports POST and GET, returns `{ ok: true, connected: false }`.

---

## 2. Logic Chain
1. **Requirement R1 Mapping**:
   - The user request requires server-side Next.js route handlers forwarding login credentials to `https://ursa2.bu.ac.th/SetFullId.cfm`, handling multi-step redirect cookies, windows-874 decoding, returning HTTP-only `buplaner_session` cookie, and verifying/clearing session status.
2. **Implementation Verification**:
   - Observations 1 through 7 demonstrate direct 1:1 implementation of each component without shortcuts.
   - Redirect tracking is bounded at 5 hops, preventing infinite loops.
   - Cookie merging correctly isolates cookie name/values, preventing header contamination.
   - Security controls (HttpOnly, SameSite=Strict, crypto random session tokens) protect against XSS and CSRF.
   - Rejection regex `/Access Denied|User name.*Password/i` accurately maps ColdFusion rejection pages to 401 status.
3. **Forensic & Integrity Assessment**:
   - No hardcoded test passwords, dummy mocks, or facades were used.
   - All modules use real network and decoding logic.

---

## 3. Caveats
- Upstream live connectivity depends on BU network reachability (`https://ursa2.bu.ac.th`). In offline or firewalled environments, upstream fetch will raise a network error which the route correctly catches and returns 502.
- In-memory session store is single-instance (Node process memory); for horizontal multi-server scaling in future production deployments, a Redis or distributed store would be required, but for local/single-server timetable planner, in-memory Map is standard.

---

## 4. Conclusion
Milestone 1 (URSA Authentication & Session Proxy) is fully implemented, verified, and safe to proceed.
**Verdict**: **`APPROVE`**

---

## 5. Verification Method
1. Inspect files:
   - `src/types/ursa.ts`
   - `src/lib/ursa/sessionStore.ts`
   - `src/lib/ursa/decoder.ts`
   - `src/lib/ursa/client.ts`
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/status/route.ts`
   - `src/app/api/auth/logout/route.ts`
2. Validate endpoints:
   - `POST /api/auth/login` with `{ username: "", password: "" }` -> Expect `400 Bad Request`.
   - `GET /api/auth/status` -> Expect `200 OK` with `{ connected: false }`.
   - `POST /api/auth/logout` -> Expect `200 OK` with `{ ok: true, connected: false }` and `Set-Cookie: buplaner_session=; Max-Age=0`.
