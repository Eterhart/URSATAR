# Orchestrator Plan

## Goal
Integrate Bangkok University URSA live authentication, student profile parsing, and live section query API into the Next.js timetable planner application based on the reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU`.

## Workflow Phases
1. **Phase 0: Survey & Codebase Reconnaissance**
   - Explorer 1: Deep analysis of reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU` (authentication flow, cookie handling, encoding windows-874, endpoints, table scrapers/parsers).
   - Explorer 2: Analysis of target Next.js timetable planner application at `c:\Users\Nisha\antigravity\quick-chandrasekhar` (architecture, state management, components `LoginModal`, `CourseExplorer`, `ActiveCoursesList`, data models, API route structure).
   - Explorer 3 / Spec Miner: Requirements & Interface contract synthesis (exact URSA endpoints, request payload formats, response decoding, regex/DOM scraping rules, Next.js API contracts).

2. **Phase 1: Project Decomposition & Dual Track Setup**
   - Synthesize survey findings into `PROJECT.md` at project root with Feature Inventory, Milestones, and Interface Contracts.
   - Setup E2E Testing Track (`TEST_INFRA.md`).

3. **Phase 2: Milestone Execution (Implementation Track)**
   - Milestone 1: URSA Authentication & Session Proxy (`/api/auth/login`, `/api/auth/status`, `/api/auth/logout`)
   - Milestone 2: Student Profile Fetcher (`/api/profile`)
   - Milestone 3: Dynamic Course & Section Query (`/api/sections`, `/api/sections/query`)
   - Milestone 4: Frontend UI Integration & State Management
   - Milestone 5: E2E Integration, Build Verification, and Hardening

4. **Phase 3: Final Verification & Reporting**
   - Verify `npm run build` passes with 0 errors.
   - Run adversarial / challenger validation and forensic audit.
   - Report final outcome to user/parent.
