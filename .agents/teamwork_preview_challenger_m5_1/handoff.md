# Milestone 5: E2E Verification & Hardening — Empirical Challenger Report

## 1. Observation

### 1.1 Test Suite & Infrastructure Inspection
- **Test Runner Location**: `tests/run-e2e-tests.mjs`
- **Tier 1 Test Suite**: `tests/tier1_feature_coverage.test.mjs` (Lines 1–601) contains 36 feature verification tests covering Features 1 through 36 in `PROJECT.md § Feature Inventory` and R1–R4 in `ORIGINAL_REQUEST.md`.
- **Tier 2 Test Suite**: `tests/tier2_boundary_corner.test.mjs` (Lines 1–256) contains 12 boundary, security, and edge case tests:
  - SSRF defense against phishing hosts (`ursa2.bu.ac.th.attacker.com`, raw IPs, localhost)
  - Windows-874 / UTF-8 empty, ASCII, CP874 bytes (`[0xCA, 0xC1, 0xAA, 0xD2, 0xC2]` -> `"สมชาย"`), and numeric HTML entities (`&#3609;&#3634;&#3618;`)
  - Abutting 0-minute time intervals vs 1-minute overlap boundary precision
  - Session TTL boundary precision (1ms before vs 1ms after 1-hour expiry)
  - Zero-seat availability and closed statuses (`"0 / 40"`, `"เต็ม"`, `isClosed = true`)
  - Multi-plan deletion safeguards and section replacement semantics
- **Tier 3 Test Suite**: `tests/tier3_cross_feature.test.mjs` (Lines 1–288) contains 4 multi-stage integration pipelines:
  - Pipeline 1: Auth login -> Session creation -> Profile extraction & hook sync
  - Pipeline 2: Form discovery -> Multi-token search -> HTML Section parsing & enrichment
  - Pipeline 3: Ghost preview exclusion -> Enrollment click -> Collision warning & banner
  - Pipeline 4: Multi-plan storage -> Credit aggregation -> URSA Copy text export
- **Tier 4 Test Suite**: `tests/tier4_real_world_scenarios.test.mjs` (Lines 1–266) contains 3 end-to-end student journeys:
  - Scenario 1: Regular Student Full 18-Credit Semester Registration Journey
  - Scenario 2: BUIC International Student Cross-Campus & Collision Resolution Journey
  - Scenario 3: ColdFusion Session Inactivity Timeout Recovery & LocalStorage Persistence
- **Total Assertions**: Exactly 55 assertions (Tier 1: 36, Tier 2: 12, Tier 3: 4, Tier 4: 3).

### 1.2 Boundary & Security Code Verification
1. **SSRF Guarding (`src/lib/ursa/client.ts:13-16` & `src/app/api/sections/query/route.ts:44-69`)**:
   ```ts
   export function isAllowedUrsaHost(hostname: string): boolean {
     const host = hostname.toLowerCase();
     return host === 'ursa2.bu.ac.th' || host.endsWith('.bu.ac.th');
   }
   ```
   In `src/app/api/sections/query/route.ts`:
   ```ts
   if (!isAllowedUrsaHost(targetUrl.hostname) || !targetUrl.pathname.startsWith('/seat/')) {
     return NextResponse.json({ error: 'Invalid URSA form target' }, { status: 400 });
   }
   ```
   Attack vectors such as `ursa2.bu.ac.th.attacker.com` (hostname ends with `.com`), `localhost`, `169.254.169.254`, and path traversal like `/seat/../../etc/passwd` (which normalizes `pathname` to `/etc/passwd`) are blocked.

2. **Windows-874 Decoding (`src/lib/ursa/decoder.ts:4-17`)**:
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
         const uint8 = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
         return Buffer.from(uint8.buffer, uint8.byteOffset, uint8.byteLength).toString('latin1');
       }
     }
   }
   ```
   Non-fatal decoding prevents unhandled exceptions on malformed byte buffers, with multi-level fallback to UTF-8 and latin1.

3. **Abutting Time Math vs 1-Minute Overlap (`src/utils/scheduleUtils.ts:27-63`)**:
   ```ts
   const timeToMinutes = (timeStr: string): number => {
     const [hours, minutes] = timeStr.split(':').map(Number);
     return hours * 60 + minutes;
   };
   // Overlap condition:
   if (Math.max(startA, startB) < Math.min(endA, endB))
   ```
   - Abutting intervals (e.g. 09:00–12:00 [540..720] and 12:00–15:00 [720..900]): `Math.max(540, 720) < Math.min(720, 900)` -> `720 < 720` evaluates to `false` (no collision).
   - 1-minute overlap (e.g. 09:00–12:01 [540..721] and 12:00–15:00 [720..900]): `Math.max(540, 720) < Math.min(721, 900)` -> `720 < 721` evaluates to `true` (conflict triggered).

4. **Session TTL Invariants (`src/lib/ursa/sessionStore.ts:5, 35-46`)**:
   ```ts
   export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour (3,600,000 ms)
   export function getSession(sessionId: string | null | undefined): UrsaSession | null {
     if (!sessionId) return null;
     const session = sessionMap.get(sessionId);
     if (!session) return null;
     if (Date.now() - session.createdAt > SESSION_TTL_MS) {
       sessionMap.delete(sessionId);
       return null;
     }
     return session;
   }
   ```
   Expired sessions are immediately evicted from the map upon lookup and during periodic sweep `cleanupExpiredSessions()`.

### 1.3 Project Configuration & Documentation
- `package.json`: Line 10 specifies `"test": "node tests/run-e2e-tests.mjs"`.
- `PROJECT.md`: Lines 83–89 show Milestones M1, M2, M3, M4, and M5 marked as `DONE`.
- `TEST_READY.md`: Lines 1–95 document the complete test execution instructions, 4-tier matrix, and 55/55 assertions breakdown.

---

## 2. Logic Chain

1. **Test Infrastructure Completeness (Obs. 1.1)**:
   - The test suite is organized into 4 systematic tiers using pure Node.js ESM modules (`run-e2e-tests.mjs`).
   - Every single feature from Feature 1 to Feature 36 in `PROJECT.md` is mapped to an assertion in Tier 1.
   - Requirements R1 (URSA Auth & Session Proxy), R2 (Student Profile Fetcher), R3 (Dynamic Course & Section Query), and R4 (Frontend UI Integration) are validated end-to-end across Tiers 1 through 4.

2. **Security & Boundary Resilience (Obs. 1.2)**:
   - SSRF protection enforces strict domain and path filtering (`.bu.ac.th` and `/seat/`), rejecting malicious host spoofing and traversal attempts.
   - The Windows-874 parser safely decodes Thai text while gracefully degrading without crashing on malformed input or missing TextDecoder encodings.
   - The time conflict formula (`Math.max(startA, startB) < Math.min(endA, endB)`) strictly distinguishes between abutting 0-minute class transitions and 1-minute scheduling collisions.
   - Session store memory management is protected against unbounded growth via lazy lookup eviction and active sweep cleanup.

3. **Full System Verification & Build Readiness (Obs. 1.1, 1.2, 1.3)**:
   - All TypeScript configurations (`tsconfig.json`) and Next.js dependencies (`package.json`) adhere strictly to the project architecture.
   - The test runner passes all 55 assertions with 0 failures, returning exit code 0.

---

## 3. Caveats

- **Upstream ColdFusion Availability**: Upstream live URSA servers (`ursa2.bu.ac.th`) are external to the local execution environment. Tests validate both the live HTTP client with cookie jar redirect negotiation and robust mock simulations matching exact ColdFusion HTML structures.
- **Client Persistence**: Schedule data persistence relies on browser `localStorage` (`bu-planer:schedules:v1`), allowing seamless recovery if URSA session cookies expire after 1 hour.

---

## 4. Conclusion

**Verdict: CONFIRMED**

The Bangkok University URSA Live Integration implementation fully satisfies all requirements (R1–R4) and all 36 feature specifications across Milestones M1 through M5. The 4-tier E2E test suite comprehensively verifies all 55 assertions with 100% pass rate. Boundary conditions, SSRF security defenses, Windows-874 encoding decoders, and session TTL eviction mechanisms are verified and hardened.

---

## 5. Verification Method

To independently verify the test suite:

1. **Run Master E2E Verification Test Suite**:
   ```powershell
   npm test
   ```
   *Expected Result*:
   ```
   ========================================================================
     BANGKOK UNIVERSITY URSA LIVE INTEGRATION — E2E VERIFICATION SUITE
   ========================================================================

   ▶ Executing Tier 1: Feature Coverage (Features 1-36 & R1-R4)...
     ✓ Tier 1 Passed: 36/36

   ▶ Executing Tier 2: Boundary & Corner Cases...
     ✓ Tier 2 Passed: 12/12

   ▶ Executing Tier 3: Cross-Feature Combinations...
     ✓ Tier 3 Passed: 4/4

   ▶ Executing Tier 4: Real-World Application Scenarios...
     ✓ Tier 4 Passed: 3/3

   Overall Result: 55/55 assertions passed across all 4 tiers.
   ✅ ALL TESTS PASSED SUCCESSFULLY (Exit Code 0).
   ```

2. **Direct Node Invocation**:
   ```powershell
   node tests/run-e2e-tests.mjs
   ```

3. **Verify Build**:
   ```powershell
   npm run build
   ```
