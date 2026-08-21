# Milestone 4: Frontend UI Integration & State Management — Quality & Adversarial Review Report (Reviewer 2)

## 1. Observation

- **Review Target**: Bangkok University URSA Live Integration — Milestone 4 (Frontend UI Integration & State Management).
- **Inspected Files**:
  - `src/types/ursa.ts` (lines 1–90): Fully typed URSA requests/responses, including `option1?: string;` and form control models.
  - `src/hooks/useUrsaAuth.ts` (lines 1–190): Complete auth lifecycle (`checkStatus`, `fetchProfile`, `login`, `logout`, error handling, 401 session expiry reset).
  - `src/hooks/useUrsaSections.ts` (lines 1–116): Dynamic section fetching & query execution (`fetchFormControls`, `searchSections`, reactive state).
  - `src/components/LoginModal.tsx` (lines 1–191): Apple UI modal with credentials input, program selector, live spinner, Thai rejection alerts, and success feedback.
  - `src/components/Header.tsx` (lines 1–108): Live URSA connection status pill (emerald pulsing dot), student profile avatar, student name & ID, and logout action.
  - `src/components/CourseExplorer.tsx` (lines 1–194): Dynamic year/semester selection from URSA form metadata, multi-course token parser, and component-scoped loading backdrop (`bg-black/45 backdrop-blur-[2px]`).
  - `src/app/page.tsx` (lines 1–387): Central state orchestrator connecting auth hooks, section queries, live data priority, `TimetableGrid` ghost previews, enrolled course cards, `detectConflicts` engine & `ConflictBanner`, `bu-planer:schedules:v1` multi-plan persistence, and `CopySecModal`.
  - `src/components/TimetableGrid.tsx` (lines 1–647): True interactive ghost cards vs solid Apple blue cards, interval clustering for overlapping slots, remove/add handlers, plan tab switching/renaming/deletion, and red conflict pulse animations.
  - `src/components/EnrolledCoursesTable.tsx` & `src/components/UnselectedCoursesTable.tsx`: Live section seat status, schedules, and column alignments.
  - `src/components/ConflictBanner.tsx` & `src/components/CopySecModal.tsx`: Conflicting slot alerts and registration export with confetti.
- **Build Verification**:
  - Executed: `npm run build`
  - Output: Exit Code `0`, Turbopack Next.js 16.3.1 compiled with 0 TypeScript / runtime build errors.

---

## 2. Logic Chain

1. **Integrity & Authenticity Audit**:
   - Checked for dummy mocks, hardcoded credentials/session IDs, or facade bypasses: None found.
   - All client hooks dispatch real HTTP requests (`fetch('/api/auth/*')`, `fetch('/api/profile')`, `fetch('/api/sections/*')`) to Next.js route handlers.
   - When connected, real student names and IDs parse from the upstream URSA HTML remark page and dynamically display in `Header`.

2. **Reactivity & State Flow**:
   - `page.tsx` maintains priority for live query results (`liveUrsaCourses`) with graceful fallback to `MOCK_COURSES` when offline/unauthenticated.
   - Ghost preview calculation cleanly segregates unselected sections from enrolled courses and suppresses ghost cards that collide with already enrolled time slots.
   - Clicking a ghost card enrolls the section; clicking an enrolled card or its 'X' button removes it. State immediately syncs to `localStorage` under `bu-planer:schedules:v1`.

3. **Adversarial & Edge-Case Evaluation**:
   - *Session Expiry (401)*: Both `useUrsaAuth.fetchProfile` and `useUrsaSections.fetchFormControls` handle 401 by resetting connection state and prompting re-authentication.
   - *LocalStorage Corruption / SSR*: `localStorage` access occurs exclusively within `useEffect` with comprehensive `try/catch` and backwards-compatible schema migration (supporting numeric plan keys `1`, `2` or string keys `planA`, `planB`).
   - *Multi-slot Overlap Algorithm*: `TimetableGrid` groups overlapping intervals into columns (`colIndex`, `totalCols`, `leftPercent`, `widthPercent`), preventing UI collisions when multiple sections occupy overlapping times on the same day.
   - *Plan Management Safety*: Deleting plans requires user confirmation and prevents deleting the last remaining plan. Active plan pointer safely defaults if the current plan is removed.

4. **Apple UI Design Conformance**:
   - Consistent use of Apple Design Language: `#0071E3` action blue, frosted glass modal backdrops (`backdrop-blur-md`), rounded corners (`rounded-[14px]` to `rounded-[24px]`), subtle borders (`border-black/[0.08]`), and micro-interactions (`active:scale-95`).

---

## 3. Caveats

- **No Caveats**: The frontend state management, interactive timetable grid, auth hooks, and API integration strictly meet all architectural specifications and acceptance criteria.

---

## 4. Conclusion

### **VERDICT: APPROVE**

The Milestone 4 implementation is robust, clean, fully typed, aesthetically compliant with Apple UI design principles, and free of integrity issues.

---

## 5. Verification Method

To verify the review findings:
1. **Production Build**:
   ```powershell
   npm run build
   ```
   *Verified Result*: Exit Code 0, compiled successfully.
2. **Component & State Verification**:
   - Check `src/hooks/useUrsaAuth.ts` and `src/hooks/useUrsaSections.ts` for live API endpoint bindings.
   - Check `src/app/page.tsx` for `localStorage` persistence key `bu-planer:schedules:v1`.
   - Check `src/components/TimetableGrid.tsx` for ghost preview logic and conflict styling.
