# Changes Report — Milestone 1 Remediation & Fixes

## Overview
Remediated the issues and vulnerabilities discovered during Milestone 1 challenge analysis:
1. **TS2769 Fix in `src/lib/ursa/decoder.ts`**: Safely converted `ArrayBuffer | Uint8Array` to `Uint8Array` before passing to `Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength)` to resolve TypeScript compilation errors during Next.js Turbopack build.
2. **Upstream 5xx Error Classification in `src/lib/ursa/client.ts`**: Upstream HTTP 5xx responses (500, 502, 503, 504) or missing cookies without explicit credential rejection text now cleanly throw `URSA_UNAVAILABLE` (mapped to HTTP 502 Bad Gateway) rather than erroneously triggering `URSA_REJECTED_CREDENTIALS` (HTTP 401).
3. **Fetch Timeout Guard**: Added `signal: AbortSignal.timeout(10000)` (10 seconds timeout) to all upstream fetch requests (`landingResponse`, `SetFullId`, redirect hops, and `fetchUrsa`) to prevent unhandled hang conditions.
4. **Redirect Host Whitelisting**: Added `isAllowedUrsaHost()` hostname validation (`ursa2.bu.ac.th` and `*.bu.ac.th`) to prevent session cookie exfiltration via cross-domain redirects.
5. **Test Enhancements**: Added comprehensive test cases covering ArrayBuffer decoding, hostname whitelisting, 503 pre-flight errors, 500 login errors, and cross-domain redirect attacks.

---

## Detailed File Changes

### 1. `src/lib/ursa/decoder.ts`
- **Change**: Updated fallback decode block in `decodeWindows874`:
  ```ts
  const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString('latin1');
  ```
- **Rationale**: Eliminates TypeScript TS2769 overload resolution error for union type `ArrayBuffer | Uint8Array`.

### 2. `src/lib/ursa/client.ts`
- **Change**:
  - Defined `DEFAULT_TIMEOUT_MS = 10000`.
  - Added `isAllowedUrsaHost(hostname: string): boolean` helper checking `hostname === 'ursa2.bu.ac.th' || hostname.endsWith('.bu.ac.th')`.
  - In `loginUrsa`:
    - Added `signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` to pre-flight, login POST, and redirect GET calls.
    - Verified `landingResponse.status < 500`, `response.status < 500`, throwing `URSA_UNAVAILABLE` on 5xx.
    - Added domain validation before following 30x redirects (`isAllowedUrsaHost(nextUrl.hostname)`), throwing `URSA_UNAVAILABLE` if untrusted.
    - Separated explicit regex check `/Access Denied|User name.*Password/i` (throws `URSA_REJECTED_CREDENTIALS`) from missing cookies check `!cookieJar` (throws `URSA_UNAVAILABLE`).
  - In `fetchUrsa`:
    - Added `signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS)` to default to 10s timeout while allowing caller override.

### 3. `src/lib/ursa/__tests__/m1_challenge.test.ts`
- **Change**:
  - Added test case verifying `decodeWindows874` works directly with pure `ArrayBuffer` objects.
  - Added test case verifying `isAllowedUrsaHost` accepts valid BU hostnames and rejects external/phishing domains.

### 4. `src/lib/ursa/__tests__/m1_simulation.test.ts`
- **Change**:
  - Added test case for 503 Service Unavailable during pre-flight seed returning `URSA_UNAVAILABLE`.
  - Added test case for 500 Internal Server Error during `SetFullId.cfm` returning `URSA_UNAVAILABLE`.
  - Added test case for cross-domain redirect attempt returning `URSA_UNAVAILABLE`.
  - Fixed TypeScript assertion typings.

---

## Build & Conformance Verification
- Ran `npm run build`: Next.js 16.3.1 (Turbopack) successfully compiled and completed TypeScript type checking in 1.7s with 0 errors.
- Generated static and dynamic route handlers:
  - `/` (Static)
  - `/_not-found` (Static)
  - `/api/auth/login` (Dynamic)
  - `/api/auth/logout` (Dynamic)
  - `/api/auth/status` (Dynamic)
