# Handoff Report: Milestone 1 (URSA Auth & Session Proxy)

## 1. Observation
- **Target Repository**: `quick-chandrasekhar` with Next.js 16.3.1 App Router, React 19.2.8, TypeScript 5 (`package.json:15-28`).
- **Path Aliases**: `@/*` mapped to `./src/*` (`tsconfig.json:22-23`).
- **Reference Implementation**: `ScheduleBU/server.js:1-60` implements the URSA handshake:
  - Landing seed `GET /seat/seat1.cfm` (`ScheduleBU/server.js:18`).
  - Login `POST /SetFullId.cfm` with `liveid`, `inter_passwd`, `option1` (`ScheduleBU/server.js:20`).
  - Manual 30x redirect following up to 5 hops with cookie accumulation (`ScheduleBU/server.js:22-26`).
  - Windows-874 body decoding with `TextDecoder('windows-874')` (`ScheduleBU/server.js:14`).
  - Credential rejection check: `/Access Denied|User name.*Password/i` (`ScheduleBU/server.js:28`).
  - 1-hour session store with `crypto.randomBytes(32).toString('base64url')` and `buplaner_session` HTTP-Only cookie (`ScheduleBU/server.js:38-40`).
- **Specification**: `PROJECT.md:43-53` and `spec.md:68-196` define feature requirements #1 through #9 for Milestone 1.

## 2. Logic Chain
1. **Authentication Reliability**: URSA uses ColdFusion session tracking (`CFID`, `CFTOKEN`, `JSESSIONID`) across multiple 302 redirects. Automatic fetch redirect following can drop intermediate `Set-Cookie` headers. Therefore, `client.ts` must use `redirect: 'manual'` and iterate over redirect hops, accumulating cookies into a merged string.
2. **Character Encoding Fidelity**: URSA server responses are encoded in Windows-874. Node.js `fetch.text()` defaults to UTF-8 and corrupts Thai characters. Therefore, `decoder.ts` must take the binary `ArrayBuffer` and decode it using `TextDecoder('windows-874')`.
3. **Session Store Stability**: In Next.js dev server, module re-evaluation can reset top-level `Map` instances on hot reload. Therefore, `sessionStore.ts` must bind the session map to `globalThis.ursaSessions` in non-production environments.
4. **App Router Route Handlers**: `login/route.ts`, `status/route.ts`, and `logout/route.ts` must implement `NextRequest` / `NextResponse` semantics and manage the `buplaner_session` cookie with `HttpOnly`, `SameSite=Strict`, `Path=/`, and `Max-Age=3600` (or `Max-Age=0` on logout).

## 3. Caveats
- Direct network access to `https://ursa2.bu.ac.th` depends on the host machine's internet connectivity and URSA server uptime. In simulated or offline test environments, mock fixtures should test the decoding and cookie aggregation logic.
- Node.js built-in `TextDecoder('windows-874')` is available in standard Node.js releases; fallback to UTF-8/Latin1 is included for non-standard environments.

## 4. Conclusion
The implementation blueprint for Milestone 1 is completely defined, self-contained, and ready for Worker execution. All 7 target files have concrete source code and interfaces:
1. `src/types/ursa.ts`
2. `src/lib/ursa/sessionStore.ts`
3. `src/lib/ursa/decoder.ts`
4. `src/lib/ursa/client.ts`
5. `src/app/api/auth/login/route.ts`
6. `src/app/api/auth/status/route.ts`
7. `src/app/api/auth/logout/route.ts`

## 5. Verification Method
1. **File Inspection**: Verify all 7 files are created in their designated directories with correct imports (`@/*`).
2. **Build Verification**: Run `npm run build` to ensure 0 TypeScript compilation errors and valid Next.js App Router route manifests.
3. **Endpoint Integration Testing**:
   - `curl -X POST http://localhost:3000/api/auth/login -H "Content-Type: application/json" -d '{"username":"","password":""}'` -> Expect HTTP 400.
   - `curl http://localhost:3000/api/auth/status` -> Expect `{ "connected": false }`.
   - `curl -X POST http://localhost:3000/api/auth/logout` -> Expect `{ "ok": true, "connected": false }` with `Max-Age=0`.
