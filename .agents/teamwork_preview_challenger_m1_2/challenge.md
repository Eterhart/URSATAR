# Adversarial Challenge Report: Milestone 1 (URSA Auth & Session Proxy)

## Verdict: CONFIRMED
Vulnerabilities, edge-case failure modes, and a build-breaking TypeScript error have been empirically identified and confirmed in Milestone 1 implementation.

---

## Challenge Summary

**Overall risk assessment**: HIGH

Milestone 1 implements the core authentication flow, session management, and HTTP route handlers. However, adversarial stress testing surfaces 4 critical/high vulnerabilities and failure modes:
1. **TypeScript Build Break TS2769**: `Buffer.from(buffer)` in `src/lib/ursa/decoder.ts` fails Next.js type checking, breaking `npm run build`.
2. **Upstream 502/503 Misclassified as Credential Rejection (401)**: When upstream URSA server returns 500/502/503 with no cookies (e.g. server maintenance), `loginUrsa` checks `!cookieJar` and throws `URSA_REJECTED_CREDENTIALS`, causing the route to return 401 (Wrong password) instead of 502 (Upstream error).
3. **Unbounded Upstream Fetch Stalls (Missing Timeout)**: `fetch()` calls in `src/lib/ursa/client.ts` lack `AbortSignal.timeout()`, making serverless/Node threads vulnerable to hanging if URSA upstream is unresponsive or slow.
4. **Cross-Domain Redirect Cookie Leak Risk**: Redirect loop follows any URL in `Location` header without validating host origin against `ursa2.bu.ac.th`, creating a potential session cookie exfiltration risk if upstream issues an off-domain redirect.

---

## Challenges

### [Critical] Challenge 1: TypeScript Overload Failure in `decoder.ts` Breaks Production Build
- **Assumption challenged**: Implementation passes TypeScript compilation during `npm run build`.
- **Attack scenario**: Executing `npm run build` runs Next.js Turbopack compiler and type check.
- **Empirical observation**:
  ```
  src/lib/ursa/decoder.ts(13,26): error TS2769: No overload matches this call.
    Argument of type 'ArrayBuffer | Uint8Array<ArrayBufferLike>' is not assignable to parameter of type 'WithImplicitCoercion<string | ArrayLike<number>>'.
      Type 'ArrayBuffer' is not assignable to type 'WithImplicitCoercion<string | ArrayLike<number>>'.
  Failed to type check.
  ```
- **Blast radius**: Production build fails completely. Violates Acceptance Criteria R5 / Item 34 (`npm run build` 0 errors).
- **Mitigation**: In `src/lib/ursa/decoder.ts:13`, convert buffer to Uint8Array before Buffer.from, e.g.:
  `Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)).toString('latin1')`

---

### [High] Challenge 2: Upstream 500/502/503 Maintenance Mode Misclassified as 401 Invalid Credentials
- **Assumption challenged**: An empty upstream cookie jar implies user entered invalid credentials.
- **Attack scenario**: If `ursa2.bu.ac.th` is down for maintenance, returns a 503 Service Unavailable HTML page or 502 Bad Gateway with no `Set-Cookie` headers:
  1. `landingResponse` returns status 503 with no cookies (`cookieJar = ""`).
  2. POST `/SetFullId.cfm` returns 503 with no cookies.
  3. `client.ts` line 108 evaluates `if (!cookieJar || /Access Denied|User name.*Password/i.test(html))`.
  4. Because `!cookieJar` is true (`""`), it executes `throw new Error('URSA_REJECTED_CREDENTIALS')`.
  5. `login/route.ts` line 55 catches `URSA_REJECTED_CREDENTIALS` and responds with HTTP 401: `"URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่"`.
- **Blast radius**: Legitimate users with valid credentials receive "wrong password" errors during university maintenance or network outages, causing confusion and repeated failed login attempts.
- **Mitigation**: Distinguish between explicit rejection (`/Access Denied|User name.*Password/i.test(html)`) and upstream non-200/missing cookies. If upstream returns non-200 or missing cookies without rejection text, throw `URSA_UPSTREAM_ERROR` to return HTTP 502.

---

### [Medium] Challenge 3: Unbounded Upstream Network Latency / Hanging Fetch
- **Assumption challenged**: Bangkok University upstream servers always respond promptly.
- **Attack scenario**: URSA upstream experiences connection stalls, dropped packets, or TCP half-open states.
- **Blast radius**: Node.js / Next.js request handler threads hang indefinitely, exhausting server connection pools and memory under concurrent user traffic.
- **Mitigation**: Provide an `AbortSignal.timeout(10000)` (10-second timeout) to all upstream `fetch()` invocations in `client.ts`.

---

### [Medium] Challenge 4: Cross-Domain Redirect Following Without Hostname Whitelist
- **Assumption challenged**: URSA 30x redirect `Location` headers only point to trusted BU domains.
- **Attack scenario**: If upstream server returns a 302 redirect pointing to an external domain (e.g. `https://external-auth.bu.ac.th` or malicious open redirect `https://attacker.com/oauth`), `client.ts` line 91 parses `nextUrl = new URL(location, URSA_BASE_URL)` and forwards `Cookie: cookieJar` to `nextUrl`.
- **Blast radius**: ColdFusion session tokens (`CFID`, `CFTOKEN`) leaked to third-party endpoints.
- **Mitigation**: Validate that `nextUrl.hostname === 'ursa2.bu.ac.th'` or ends with `.bu.ac.th` before following redirects.

---

## Stress Test Results

| Test Scenario | Stress Dimension | Expected Behavior | Actual Behavior | Result |
|---|---|---|---|---|
| **ST-1**: Empty / Null / Non-string credentials (`{}`, `null`, `""`, `12345`) | Input Sanitization | HTTP 400 with `{ error: 'username and password are required' }` | Correctly caught and returned HTTP 400 | **PASS** |
| **ST-2**: Extreme input length (100k char username/password) | Input Stress / ReDoS | Handled safely without server crash | URLSearchParams encodes safely; handled by catch block | **PASS** |
| **ST-3**: Upstream network connection refused / DNS failure | Fault Injection | Returns HTTP 502 with Thai error description | Throws TypeError, caught in route, returns 502 | **PASS** |
| **ST-4**: Upstream 502/503 maintenance without cookies | Fault Injection | Returns HTTP 502 (Upstream failure) | Returns HTTP 401 (Wrong password) due to `!cookieJar` check | **FAIL** |
| **ST-5**: Infinite 302 redirect loop (>5 hops) | Redirect Limits | Loops terminate after 5 hops without infinite recursion | Loops break after 5 hops (`MAX_REDIRECT_HOPS = 5`) | **PASS** |
| **ST-6**: Multi-cookie merging with overlapping keys | State Consistency | Overlapping cookie keys updated to newest values | `mergeCookies()` deduplicates and overrides keys correctly | **PASS** |
| **ST-7**: Concurrent session generation (100 simultaneous requests) | Concurrency & Race Conditions | 100 unique crypto base64url tokens, no collisions | Base64url 32-byte crypto generation; thread-safe Map operations | **PASS** |
| **ST-8**: Session expiration & sweep after 1 hour (3600s TTL) | Memory & Expiration | Expired sessions return null and get purged from map | `Date.now() - createdAt > 3600000` deletes and purges correctly | **PASS** |
| **ST-9**: Cookie Security Attributes on `/api/auth/login` | Security & Compliance | `HttpOnly; SameSite=Strict; Path=/; Max-Age=3600` | Attributes set correctly in response headers | **PASS** |
| **ST-10**: Cookie Clear Attributes on `/api/auth/logout` | Security & Compliance | `HttpOnly; SameSite=Strict; Path=/; Max-Age=0` | Attributes set correctly with Max-Age=0 | **PASS** |
| **ST-11**: TypeScript Compilation (`npm run build`) | Build Conformance | 0 TypeScript errors | TS2769 error in `src/lib/ursa/decoder.ts:13` | **FAIL** |

---

## Unchallenged Areas

- **Profile and Section Query Parser logic** (`profileParser.ts`, `sectionParser.ts`): Out of scope for Milestone 1; allocated to Milestones 2 and 3.
