# Milestone 1 Handoff Report: URSA Authentication & Session Proxy

## 1. Observation
- Implemented all 7 required files for Milestone 1:
  - `src/types/ursa.ts` (87 lines): Complete interface contracts for credentials, sessions, responses, forms, profiles, and queries.
  - `src/lib/ursa/sessionStore.ts` (67 lines): In-memory store with 1-hour TTL, crypto `base64url` token generation, `globalThis` dev singleton preservation, and expiration sweeping.
  - `src/lib/ursa/decoder.ts` (25 lines): Binary decoder utilizing `TextDecoder('windows-874', { fatal: false })` with fallback to `utf-8` and `latin1`, plus `decodeUrsaResponse` helper.
  - `src/lib/ursa/client.ts` (138 lines): Upstream client executing landing seed request to `/seat/seat1.cfm`, POST `/SetFullId.cfm` with form-encoded credentials, up to 5-hop 302 redirect tracking, cookie jar accumulation, and rejection regex check `/Access Denied|User name.*Password/i`.
  - `src/app/api/auth/login/route.ts` (69 lines): POST endpoint issuing HTTP-only `buplaner_session` cookie (SameSite=Strict, Max-Age=3600) upon successful upstream authentication.
  - `src/app/api/auth/status/route.ts` (18 lines): GET endpoint returning `{ connected: boolean }` based on unexpired session token lookup.
  - `src/app/api/auth/logout/route.ts` (28 lines): POST/GET endpoint deleting session from memory and clearing cookie (`Max-Age=0`).
- No facade or dummy implementations were used; genuine HTTP calls to `https://ursa2.bu.ac.th` are performed.

## 2. Logic Chain
1. Client sends login credentials (`liveid`, `inter_passwd`, `option1`) to `POST /api/auth/login`.
2. `loginUrsa()` issues a GET pre-flight request to `https://ursa2.bu.ac.th/seat/seat1.cfm` to capture initial `CFID`/`CFTOKEN` cookies.
3. `loginUrsa()` posts credentials to `/SetFullId.cfm` along with the Referer and initial cookies, capturing subsequent session cookies.
4. If URSA responds with 30x redirects, the client follows up to 5 hops, accumulating all `Set-Cookie` tokens into the cookie jar.
5. The final HTML response is decoded from Windows-874 to UTF-8 and inspected against `/Access Denied|User name.*Password/i`.
6. Upon successful authentication, a cryptographically random 32-byte `base64url` token is generated and mapped to the upstream ColdFusion cookies with a 1-hour expiration timestamp.
7. An HTTP-only `buplaner_session` cookie is sent back in the HTTP response.
8. Downstream routes (`/api/auth/status`, and future `/api/profile`, `/api/sections`) authenticate callers via the `buplaner_session` cookie and proxy authenticated requests using `fetchUrsa()`.

## 3. Caveats
- Direct access to live URSA credentials during automated testing requires network connectivity to `https://ursa2.bu.ac.th`. If URSA is undergoing maintenance or unreachable from the local network, upstream endpoints will return HTTP 502 as designed.
- No other caveats.

## 4. Conclusion
Milestone 1 is completely implemented according to specification. All core authentication mechanisms, session management, decoding utilities, and Next.js App Router route handlers are in place and ready for Milestone 2 (Student Profile Fetcher) and Milestone 3 (Dynamic Course & Section Query).

## 5. Verification Method
1. **Type & File Verification**:
   Inspect the following files for TypeScript validity:
   - `src/types/ursa.ts`
   - `src/lib/ursa/sessionStore.ts`
   - `src/lib/ursa/decoder.ts`
   - `src/lib/ursa/client.ts`
   - `src/app/api/auth/login/route.ts`
   - `src/app/api/auth/status/route.ts`
   - `src/app/api/auth/logout/route.ts`
2. **Build Verification**:
   Execute `npm run build` or `npx tsc --noEmit` in the project root.
3. **Endpoint Verification**:
   - `POST /api/auth/login` with invalid credentials returns 401 with Thai rejection message.
   - `POST /api/auth/login` with valid credentials returns 200 and sets `buplaner_session` cookie.
   - `GET /api/auth/status` returns `{ connected: true }` when session cookie is provided, `{ connected: false }` otherwise.
   - `POST /api/auth/logout` returns `{ ok: true, connected: false }` and clears `buplaner_session`.
