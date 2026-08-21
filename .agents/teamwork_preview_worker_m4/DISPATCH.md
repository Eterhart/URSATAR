## 2026-08-21T04:22:26+07:00
You are teamwork_preview_worker for Milestone 4: Frontend UI Integration & State Management in the Bangkok University URSA Live Integration project.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_worker_m4`.

Read the following files before starting:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m4\handoff.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your Task:
Implement the complete Frontend UI Integration and State Management following the architecture and blueprints in `teamwork_preview_explorer_m4/handoff.md`:
1. `src/types/ursa.ts`: Add `option1?: string;` to `UrsaQueryRequest` to ensure full type alignment.
2. `src/hooks/useUrsaAuth.ts`: Implement `useUrsaAuth` hook handling `connected`, `studentId`, `studentName`, `meta`, `faculty`, `department`, `isLoading`, `error`, `checkStatus`, `fetchProfile`, `login`, and `logout`.
3. `src/hooks/useUrsaSections.ts`: Implement `useUrsaSections` hook handling `form`, `courses`, `rawHtml`, `isLoading`, `error`, `fetchFormControls`, and `searchSections`.
4. `src/components/LoginModal.tsx`: Connect with live `login()` from `useUrsaAuth`, with active loading spinner, Thai error messaging, and auto-dismiss on success.
5. `src/components/Header.tsx`: Connect live connection badge (pulsing green "เชื่อมต่อ URSA แล้ว" with student name and ID; gray "ยังไม่ได้เชื่อม URSA" with "เชื่อม URSA" button; logout button).
6. `src/components/CourseExplorer.tsx`: Connect year and semester selectors discoverable from URSA form metadata, multi-course query textarea, search button with component-scoped loading overlay (`bg-black/45 backdrop-blur-[2px]`).
7. `src/app/page.tsx` and related components (`TimetableGrid.tsx`, `EnrolledCoursesTable.tsx`, `UnselectedCoursesTable.tsx`, `ActiveCoursesList.tsx`, `ConflictBanner.tsx`, `CopySecModal.tsx`):
   - Wire live URSA courses into the timetable grid, enrolled tables, and unselected tables.
   - Support interactive ghost previews for unselected search results (hover sync, exclusion if already enrolled/conflict, click to enroll).
   - Support solid Apple blue enrolled cards with removal.
   - Retain conflict detection and conflict banner.
   - Maintain `bu-planer:schedules:v1` localStorage multi-plan persistence.
   - Support `CopySecModal` registration text export.
8. Execute `npm run build` using run_command to verify 0 TypeScript and Turbopack errors.
9. Execute any available test suites.
10. Write your handoff report to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_worker_m4\handoff.md` and report back via send_message to caller.
