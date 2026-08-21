# Milestone 5: E2E Verification & Hardening — Reviewer 2 Assessment Report

## 1. Observation

- **Review Scope & Artifacts Inspected**:
  - `ORIGINAL_REQUEST.md`: Original requirements R1 (URSA Auth & Proxy), R2 (Profile Fetcher), R3 (Sections Query), and R4 (Frontend UI Integration).
  - `PROJECT.md`: Architecture overview, 36-feature inventory across Milestones M1–M5, interface contracts (`/api/auth/*`, `/api/profile`, `/api/sections/*`), and project milestone statuses.
  - `TEST_INFRA.md`: 4-tier test architecture, coverage mapping, and execution commands.
  - `TEST_READY.md`: Test readiness documentation detailing commands, 4-tier breakdown (55/55 assertions), and 36-feature coverage matrix.
  - `package.json`: Contains `"test": "node tests/run-e2e-tests.mjs"`.
  - Test Suite Implementations:
    1. `tests/run-e2e-tests.mjs`: Master ESM test runner with execution summary, status table, and exit code handling (`process.exit(0)` on 100% pass, `process.exit(1)` on error).
    2. `tests/tier1_feature_coverage.test.mjs`: 36 isolated unit/functional tests covering Features 1–36 and R1–R4.
    3. `tests/tier2_boundary_corner.test.mjs`: 12 boundary, security, and corner case tests (SSRF hostname whitelist, mixed Thai CP874 decoding & entities, abutting 0-minute boundaries, 1-minute overlap conflict detection, session TTL precision, zero-seat statuses, and multi-plan invariants).
    4. `tests/tier3_cross_feature.test.mjs`: 4 cross-feature integration pipelines (Auth->Profile sync, Form discovery->Multi-course query parsing, Ghost preview exclusion->Collision warning, Multi-plan->URSA Copy export).
    5. `tests/tier4_real_world_scenarios.test.mjs`: 3 realistic student application scenarios (18-credit regular student journey, BUIC international student collision resolution, ColdFusion session timeout recovery with localStorage retention).
  - Production Core Codebase:
    - `src/lib/ursa/sessionStore.ts`: Cryptographically secure `crypto.randomBytes(32).toString('base64url')` token generation, in-memory map with 1h TTL, automatic sweep, and session invalidation.
    - `src/lib/ursa/client.ts`: Cookie jar management, `TextDecoder('windows-874')` fallback, multi-hop redirect following, SSRF hostname verification (`isAllowedUrsaHost`), and credential rejection detector.
    - `src/lib/ursa/decoder.ts`: Binary buffer Windows-874 / UTF-8 decoding.
    - `src/lib/ursa/profileParser.ts`: Grade Report DOM/regex parser extracting student ID, student name, faculty, and department with non-blocking fallback.
    - `src/lib/ursa/sectionParser.ts`: Section table DOM/regex parser extracting course codes, section numbers, seat ratios, day/time, room/type (LAB/LECT), exams, and restrictions.
    - `src/utils/scheduleUtils.ts`: Interval collision mathematics `Math.max(startA, startB) < Math.min(endA, endB)`, total credits aggregator, and URSA copy text generator.
    - `src/app/page.tsx` & Components (`LoginModal`, `Header`, `CourseExplorer`, `TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, `CopySecModal`, `ConflictBanner`): Fully integrated live hooks (`useUrsaAuth`, `useUrsaSections`) with Apple design guidelines.

- **Integrity Check**:
  - Confirmed 0 hardcoded test results embedded in source code.
  - Confirmed 0 dummy or facade implementations.
  - All assertions in `tests/` evaluate real computation (cryptographic random tokens, Thai CP874 byte decoding, regular expressions, interval mathematics, DOM parsing).

---

## 2. Logic Chain

1. **Requirement & Feature Completeness**:
   - **R1 (URSA Auth & Session Proxy)**: Fully supported by `/api/auth/login`, `/api/auth/status`, `/api/auth/logout`, `sessionStore.ts`, and `client.ts`. Negotiates ColdFusion session cookies, handles up to 5 redirect hops, detects credential rejection via `/Access Denied|User name.*Password/i`, generates base64url tokens, and sets HTTP-only `buplaner_session` cookie (`SameSite=Strict`, `Max-Age=3600`).
   - **R2 (Student Profile Fetcher)**: Fully supported by `/api/profile`, `profileParser.ts`, and `useUrsaAuth.ts`. Decodes `/remark/remark.cfm` Windows-874 HTML, extracts 10-digit Student ID and student name, and displays them in `Header.tsx` with non-blocking fallback.
   - **R3 (Dynamic Course & Section Query)**: Fully supported by `/api/sections`, `/api/sections/query`, `sectionParser.ts`, and `useUrsaSections.ts`. Proxies form controls, executes multi-course queries, validates SSRF hostnames, and parses section tables into structured JSON.
   - **R4 (Frontend Integration with Apple UI Design)**: Fully connected in `src/app/page.tsx`. Timetable grid renders interactive ghost previews for unselected courses, solid Apple blue cards for enrolled courses, real-time conflict detection with red pulsating animations, and multi-plan management persisted in localStorage.

2. **Adversarial & Edge Case Robustness**:
   - **SSRF Defense**: Target URLs in `/api/sections/query` are validated against `isAllowedUrsaHost` and enforced to begin with `/seat/` paths, preventing SSRF attacks on internal services or external domains.
   - **Encoding & Malformed HTML**: `cleanHtmlText` and `decodeWindows874` handle raw Thai binary buffers, numeric HTML entities (`&#3609;`), and HTML injection without crashing.
   - **Abutting Time Intervals**: Abutting classes (e.g. 09:00–12:00 and 12:00–15:00) produce 0-minute overlap and correctly evaluate as non-conflicting, whereas a 1-minute overlap (09:00–12:01 and 12:00–15:00) triggers conflict alerts.
   - **Session Expiry & LocalStorage Safety**: Inactivity timeout gracefully transitions the client to unauthenticated state while preserving drafted schedules in localStorage (`bu-planer:schedules:v1`).

3. **Documentation & Contract Synchronization**:
   - `PROJECT.md` milestones M1 through M5 are properly marked `DONE`.
   - `TEST_READY.md` provides accurate execution instructions, 55/55 pass assertion breakdown, and 36-feature coverage matrix.
   - `package.json` correctly binds `"test": "node tests/run-e2e-tests.mjs"`.

---

## 3. Caveats & Assumptions

- **Caveat 1 (Upstream ColdFusion Availability)**: In production environments, URSA upstream server (`ursa2.bu.ac.th`) may experience downtime during university registration peak hours. The application handles this with HTTP 502/504 error statuses and user-friendly Thai error messages while retaining client-side drafted plans in localStorage.
- **Caveat 2 (Isolated Test Execution)**: The E2E test suite (`npm test`) is self-contained and does not require live upstream network connectivity during automated CI/CD runs.

---

## 4. Conclusion

**Verdict: APPROVE**

Milestone 5 (E2E Verification & Hardening) meets all acceptance criteria:
1. Test suite across all 4 tiers is thorough, rigorous, and free of integrity violations (55/55 assertions covering all 36 features in `PROJECT.md` and R1–R4 in `ORIGINAL_REQUEST.md`).
2. Edge cases, boundary mathematics, SSRF security, and Windows-874 encoding are hardened and verified.
3. Documentation (`PROJECT.md`, `TEST_INFRA.md`, `TEST_READY.md`) is fully synchronized and up-to-date.

---

## 5. Verification Method

To verify the test suite and documentation:
1. **Execute E2E Test Suite**:
   ```powershell
   npm test
   # Or
   node tests/run-e2e-tests.mjs
   ```
   *Expected Output*: Exit code 0, 55/55 assertions passed across all 4 Tiers (Tier 1: 36/36, Tier 2: 12/12, Tier 3: 4/4, Tier 4: 3/3).

2. **Inspect Documentation Files**:
   - `TEST_READY.md`: Confirm all 4 tiers and 36 features are documented.
   - `PROJECT.md`: Confirm Milestones M1–M5 are marked `DONE`.
