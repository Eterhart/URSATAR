# Handoff Report: Challenger 2 (Milestone 1 — URSA Auth & Session Proxy)

## 1. Observation

1. **Build Error in `src/lib/ursa/decoder.ts`**:
   - Command: `npm run build`
   - Exact output:
     ```
     > quick-chandrasekhar@0.1.0 build
     > next build

     ▲ Next.js 16.3.1 (Turbopack)
     ...
       Creating an optimized production build ...
     ✓ Compiled successfully in 1688ms
       Running TypeScript ...
     src/lib/ursa/decoder.ts(13,26): error TS2769: No overload matches this call.
       The last overload gave the following error.
         Argument of type 'ArrayBuffer | Uint8Array<ArrayBufferLike>' is not assignable to parameter of type 'WithImplicitCoercion<string | ArrayLike<number>>'.
           Type 'ArrayBuffer' is not assignable to type 'WithImplicitCoercion<string | ArrayLike<number>>'.
     Failed to type check.
     ```
   - Code location: `src/lib/ursa/decoder.ts:13`
     ```ts
     export function decodeWindows874(buffer: ArrayBuffer | Uint8Array): string {
       try {
         const decoder = new TextDecoder('windows-874', { fatal: false });
         return decoder.decode(buffer);
       } catch {
         try {
           const utf8 = new TextDecoder('utf-8', { fatal: false });
           return utf8.decode(buffer);
         } catch {
           return Buffer.from(buffer).toString('latin1');
         }
       }
     }
     ```

2. **Upstream Error Classification in `src/lib/ursa/client.ts`**:
   - Code location: `src/lib/ursa/client.ts:108-110`
     ```ts
     if (!cookieJar || /Access Denied|User name.*Password/i.test(html)) {
       throw new Error('URSA_REJECTED_CREDENTIALS');
     }
     ```
   - Code location: `src/app/api/auth/login/route.ts:55-59`
     ```ts
     if (error?.message === 'URSA_REJECTED_CREDENTIALS') {
       return NextResponse.json(
         { error: 'URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่' },
         { status: 401 }
       );
     }
     ```
   - When upstream returns 502/503 (e.g. server maintenance or outage) with no `Set-Cookie` header, `cookieJar` is empty string `""`, which causes `!cookieJar` to evaluate to `true`. This causes `loginUrsa` to throw `'URSA_REJECTED_CREDENTIALS'` and `login/route.ts` to return HTTP 401 (Invalid Credentials) instead of HTTP 502 (Bad Gateway / Upstream Outage).

3. **Missing Upstream Timeout in `src/lib/ursa/client.ts`**:
   - `fetch()` calls on lines 55, 72, and 92 do not pass `signal: AbortSignal.timeout(10000)`.

4. **Redirect Host Validation in `src/lib/ursa/client.ts`**:
   - `const nextUrl = new URL(location, URSA_BASE_URL);` on line 91 accepts arbitrary external hostnames if the upstream response contains an absolute redirect, and forwards `Cookie: cookieJar` to `nextUrl`.

5. **Input Validation & Cookie Security**:
   - `src/app/api/auth/login/route.ts`: Lines 20-31 validate `username` and `password` strings, rejecting null, empty, non-string, or whitespace-only usernames with 400.
   - `src/app/api/auth/login/route.ts`: Lines 43-51 set `buplaner_session` cookie with `httpOnly: true`, `sameSite: 'strict'`, `path: '/'`, `maxAge: 3600`, and `secure: process.env.NODE_ENV === 'production'`.
   - `src/lib/ursa/sessionStore.ts`: Generates 32-byte cryptographically secure base64url tokens with 1-hour TTL and automated expiration purging.

---

## 2. Logic Chain

1. Observation 1 directly proves that `npm run build` fails on `src/lib/ursa/decoder.ts:13` due to TypeScript compiler overload resolution on `Buffer.from(buffer)`.
2. Observation 2 demonstrates that upstream failures without cookies (500/502/503) evaluate `!cookieJar` as true, throwing `URSA_REJECTED_CREDENTIALS` and incorrectly responding with HTTP 401 (user error) rather than HTTP 502 (upstream server error).
3. Observation 3 shows that absence of `AbortSignal.timeout` allows upstream hanging requests to consume worker connections indefinitely under high latency or connection drops.
4. Observation 4 shows that unchecked multi-hop redirect URLs risk sending ColdFusion session cookies to non-BU hosts.
5. Observation 5 confirms that inputs are validated for empty/null types, concurrency is handled safely with crypto random tokens and Map operations, and session cookies enforce strict security attributes.

---

## 3. Caveats

- In-memory `sessionMap` (`src/lib/ursa/sessionStore.ts`) does not sync across multi-instance serverless deployments (e.g. Vercel multi-region serverless lambdas), but functions correctly for standard containerized or single-node Next.js runtime.
- Upstream ColdFusion endpoint `https://ursa2.bu.ac.th` live responses were simulated and verified via static and structural logic analysis.

---

## 4. Conclusion

**Verdict: CONFIRMED**

The core architecture for Milestone 1 (URSA Auth & Session Proxy) is structurally sound with secure cookie attributes and robust concurrency handling. However, the following items require remediation by the worker before Milestone 1 can be considered complete:
1. **Fix TypeScript build error in `src/lib/ursa/decoder.ts:13`** (`Buffer.from(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer)).toString('latin1')`).
2. **Refine error classification in `src/lib/ursa/client.ts:108`** so that empty cookies on upstream non-200 responses throw an upstream error (502) rather than credential rejection (401).
3. **Add timeout protection** (`AbortSignal.timeout(10000)`) on upstream fetches in `src/lib/ursa/client.ts`.
4. **Add domain whitelist check** on redirect `nextUrl.hostname` in `src/lib/ursa/client.ts`.

---

## 5. Verification Method

To independently verify these findings:
1. **TypeScript Build Verification**:
   - Run `npm run build` in repository root.
   - Invalidation condition: `npm run build` exits with code 0 without TS2769 error.
2. **Error Code Verification**:
   - Inspect `src/lib/ursa/client.ts:108` and trace response when upstream returns 503 without cookies.
   - Invalidation condition: Response returns 502 when upstream is down.
3. **Cookie Attributes Inspection**:
   - Inspect `src/app/api/auth/login/route.ts:43-51` and `src/app/api/auth/logout/route.ts:12-20`.
