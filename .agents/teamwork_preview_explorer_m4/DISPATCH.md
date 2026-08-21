## 2026-08-21T04:19:10Z
You are an Explorer agent for Milestone 4: Frontend UI Integration & State Management.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m4`.

Read:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\TEST_INFRA.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`
- Existing frontend components and hooks in `src/`:
  - `src/hooks/useUrsaAuth.ts` (or create)
  - `src/hooks/useUrsaSections.ts` (or create)
  - `src/components/LoginModal.tsx`
  - `src/components/Header.tsx`
  - `src/components/CourseExplorer.tsx`
  - `src/components/ActiveCoursesList.tsx`
  - `src/components/TimetableGrid.tsx`
  - `src/components/EnrolledCoursesTable.tsx`
  - `src/components/UnselectedCoursesTable.tsx`
  - `src/components/ConflictBanner.tsx`
  - `src/components/CopySecModal.tsx`
  - `src/components/PlanSwitcher.tsx`
  - `src/app/page.tsx`
- Reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU` (specifically `index.html` and `app.js`).

Investigate and produce a comprehensive architecture and integration blueprint for:
1. `useUrsaAuth.ts`: Hook managing connection status (`connected`, `studentId`, `studentName`, `meta`, `isLoading`, `error`, `checkStatus()`, `login()`, `logout()`). Fires `/api/auth/status` on mount and fetches `/api/profile` if connected.
2. `useUrsaSections.ts`: Hook managing live URSA form controls, academic year/semester, and multi-course section search queries via `POST /api/sections/query`.
3. `LoginModal.tsx`: Real submission to `login()` with loading spinner and Thai error message banner.
4. `Header.tsx`: Displaying student name, ID, live connection indicator (green vs gray pill with connect/disconnect actions).
5. `CourseExplorer.tsx`: Academic year/term select, multi-line / space-separated course code input, loading overlay, and live query execution.
6. `TimetableGrid.tsx`, `ActiveCoursesList.tsx`, `EnrolledCoursesTable.tsx`, `UnselectedCoursesTable.tsx`, and `page.tsx`:
   - Connecting live courses into state.
   - Interactive ghost preview cards (unselected sections rendered as outlined cards, hovering highlights across tables, clicking enrolls).
   - Solid enrolled cards (Apple blue with removal button).
   - Time conflict detection with red conflict pulse and `ConflictBanner`.
   - Multi-plan local storage persistence and switching.
   - CopySecModal live formatting and clipboard export.
7. Verification plan with `npm run build` and UI integration checks.

Write your findings and complete code blueprints to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m4\handoff.md`.
Use send_message to report completion.
