# Orchestrator Plan — Generation 2

## Mission
Deliver Milestones 2, 3, 4, and 5 for Bangkok University URSA Live Integration with zero build errors and 100% verified acceptance criteria.

## Execution Sequence

### Milestone 2: Student Profile Fetcher
- **Target Files**:
  - `src/lib/ursa/profileParser.ts`
  - `src/app/api/profile/route.ts`
- **Specification**:
  - Fetch `https://ursa2.bu.ac.th/remark/remark.cfm` with session cookie.
  - Decode binary with `decodeBuffer(buffer)`.
  - Extract student ID and Thai student name from Grade Report table.
  - Return `{ ok: true, studentId, studentName, meta }`.
  - Non-blocking fallback on empty table (`{ ok: true, studentId: "", studentName: "" }`).
- **Agents**:
  - Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor -> Gate.

### Milestone 3: Dynamic Course & Section Query
- **Target Files**:
  - `src/lib/ursa/sectionParser.ts`
  - `src/app/api/sections/route.ts`
  - `src/app/api/sections/query/route.ts`
- **Specification**:
  - GET `/api/sections`: Proxies `/seat/seat1.cfm` to discover academic year/sem form controls.
  - POST `/api/sections/query`: Proxies search queries to `https://ursa2.bu.ac.th/seat/seat1.cfm`. Validates origin whitelist.
  - Parses table into structured `Course[]` with `sections` (`sectionNo`, `day`, `startTime`, `endTime`, `room`, `instructor`, `availableSeats`, `totalSeats`, `midtermDate`, `finalDate`, `restriction`).
- **Agents**:
  - Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor -> Gate.

### Milestone 4: Frontend UI Integration & State Management
- **Target Files**:
  - `src/hooks/useUrsaAuth.ts`
  - `src/hooks/useUrsaSections.ts`
  - `src/components/LoginModal.tsx`
  - `src/components/Header.tsx`
  - `src/components/CourseExplorer.tsx`
  - `src/components/ActiveCoursesList.tsx`
  - `src/components/TimetableGrid.tsx`
  - `src/components/EnrolledCoursesTable.tsx`
  - `src/components/UnselectedCoursesTable.tsx`
  - `src/app/page.tsx`
- **Specification**:
  - Live session check on mount, profile auto-fetch on login.
  - Real section query with loading overlay.
  - Interactive ghost cards, solid enrolled cards, time conflict detection.
  - Plan switching & CopySecModal export.
- **Agents**:
  - Explorer -> Worker -> Reviewers (2) -> Challengers (2) -> Auditor -> Gate.

### Milestone 5: E2E Verification & Hardening
- **Target Files**:
  - E2E Test runner (`tests/run-e2e-tests.mjs`)
- **Specification**:
  - Run all 4 Tiers of E2E verification tests.
  - Verify `npm run build` succeeds with 0 errors.
  - Comprehensive Forensic Integrity Audit across all modules.
- **Agents**:
  - Worker (Test runner & fixes) -> Reviewers -> Auditor -> Final Gate -> Report to Parent.
