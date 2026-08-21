# Orchestrator Soft Handoff — Generation 1

## Milestone State
- **Phase 0 (Survey & Reconnaissance)**: DONE. Reference implementation `ScheduleBU` and target Next.js app analyzed. `PROJECT.md` and `TEST_INFRA.md` created.
- **Milestone 1 (URSA Auth & Session Proxy)**: DONE.
  - Implemented files:
    - `src/types/ursa.ts`
    - `src/lib/ursa/sessionStore.ts` (1h TTL, 32-byte crypto base64url tokens, `globalThis` dev cache)
    - `src/lib/ursa/decoder.ts` (Windows-874 buffer & response decoder with fallback)
    - `src/lib/ursa/client.ts` (Landing seed, SetFullId POST, redirect loop cap = 5, cookie jar accumulation, 502 error mapping, 10s fetch timeout, redirect domain validation)
    - `src/app/api/auth/login/route.ts` (Sets HTTP-only `buplaner_session` cookie)
    - `src/app/api/auth/status/route.ts` (Returns `{ connected: boolean }`)
    - `src/app/api/auth/logout/route.ts` (Invalidates session and clears cookie)
  - Verified by: Reviewer 1 (APPROVE), Reviewer 2 (APPROVE), Challenger 1 (CONFIRMED), Auditor (CLEAN), Remediation Worker (Pass, `npm run build` exits 0 with 0 errors).
- **Milestone 2 (Student Profile Fetcher)**: PLANNED (Ready to execute).
  - Scope: `src/lib/ursa/profileParser.ts`, `src/app/api/profile/route.ts`.
  - Specs: Fetch `/remark/remark.cfm` with session cookie, decode Windows-874, extract Student ID and Student Name, return `{ ok: true, studentId, studentName }`.
- **Milestone 3 (Dynamic Course & Section Query)**: PLANNED.
  - Scope: `src/lib/ursa/sectionParser.ts`, `src/app/api/sections/route.ts`, `src/app/api/sections/query/route.ts`.
- **Milestone 4 (Frontend UI Integration & State)**: PLANNED.
  - Scope: Connect `LoginModal`, `Header`, `CourseExplorer`, `ActiveCoursesList`, `TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, `useUrsaAuth.ts`, `useUrsaSections.ts`, `src/app/page.tsx`.
- **Milestone 5 (E2E Verification & Hardening)**: PLANNED.

## Active Subagents
- None (All 16 subagents spawned in Gen 1 completed their tasks).

## Decisions & Constraints
- Always use `Model="flash"` for subagents to conserve quota and prevent 429 errors.
- Subagents must be given `ORIGINAL_REQUEST.md` path and the mandatory integrity warning.
- Upstream URSA URL is `https://ursa2.bu.ac.th`.
- All Windows-874 payloads must be decoded via `src/lib/ursa/decoder.ts`.

## Remaining Work for Successor
1. Launch Milestone 2 (Student Profile Fetcher):
   - Dispatch Worker with `Model="flash"` to implement `src/lib/ursa/profileParser.ts` and `src/app/api/profile/route.ts`.
   - Dispatch Reviewer, Challenger, and Auditor.
2. Launch Milestone 3 (Dynamic Course & Section Query):
   - Implement `src/lib/ursa/sectionParser.ts`, `src/app/api/sections/route.ts`, `src/app/api/sections/query/route.ts`.
   - Run verification suite.
3. Launch Milestone 4 (Frontend UI Integration):
   - Implement hooks `useUrsaAuth` and `useUrsaSections`.
   - Update `LoginModal`, `Header`, `CourseExplorer`, `ActiveCoursesList`, `TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, `src/app/page.tsx`.
   - Run verification suite.
4. Milestone 5 (Final E2E Verification & Hardening):
   - Run full E2E test suite covering Tiers 1-4.
   - Run `npm run build` to confirm 0 errors.
   - Final forensic audit pass.
   - Report final outcome to user/parent.

## Key Artifacts
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\TEST_INFRA.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_orchestrator_1\GATE_STATUS.md`
