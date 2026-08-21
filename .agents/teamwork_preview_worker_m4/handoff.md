# Milestone 4: Frontend UI Integration & State Management — Final Implementation Report

## 1. Observation
- **Scope & Objectives**: Complete frontend UI integration and state management for URSA live integration, connecting authentication, profile parsing, dynamic section query, interactive timetable calendar with ghost previews, multi-plan storage, and export tools.
- **Pre-existing Discrepancy**:
  - `src/app/api/sections/query/route.ts` line 40 accessed `body.option1`, but `src/types/ursa.ts` defined `UrsaQueryRequest` without `option1?: string;`.
  - Frontend components were previously operating on static `MOCK_COURSES` and local React state without real API hooks or URSA session polling.
- **Implemented Source Files**:
  1. `src/types/ursa.ts`: Added `option1?: string;` to `UrsaQueryRequest` (lines 74–82).
  2. `src/hooks/useUrsaAuth.ts`: Created client hook providing `connected`, `studentId`, `studentName`, `meta`, `faculty`, `department`, `isLoading`, `error`, `checkStatus`, `fetchProfile`, `login`, `logout`, and `clearError`.
  3. `src/hooks/useUrsaSections.ts`: Created client hook providing `form`, `courses`, `rawHtml`, `isLoading`, `error`, `fetchFormControls`, `searchSections`, `setCourses`, `clearResults`, and `clearError`.
  4. `src/components/LoginModal.tsx`: Connected to real `login()` from `useUrsaAuth`, with active spinner (`กำลังเชื่อมต่อ...`), Thai error banners (`URSA ปฏิเสธ username หรือ password...`), and auto-dismiss on success.
  5. `src/components/Header.tsx`: Connected live connection badge with pulsing emerald indicator (`เชื่อมต่อ URSA แล้ว`), student name and ID display, logout trigger, and fallback gray badge (`ยังไม่ได้เชื่อม URSA`) with login CTA button.
  6. `src/components/CourseExplorer.tsx`: Connected dynamic academic year and semester selectors discoverable from URSA form metadata (`formControls`), multi-course query input with clear button, and component-scoped loading overlay (`bg-black/45 backdrop-blur-[2px]`).
  7. `src/app/page.tsx`: Wired live hooks (`useUrsaAuth`, `useUrsaSections`), live search results priority with mock fallback, interactive ghost preview sync on `TimetableGrid`, enrolled course removal, time conflict detection and `ConflictBanner`, `bu-planer:schedules:v1` localStorage multi-plan persistence, and `CopySecModal` registration export.

---

## 2. Logic Chain

1. **Type Synchronization**:
   - Aligning `UrsaQueryRequest` with `option1?: string;` ensures complete type safety between frontend query requests and backend API route handlers (`/api/sections/query`).

2. **Authentication & Session Lifecycle**:
   - `useUrsaAuth` initiates an automated status check (`GET /api/auth/status`) upon initial mount.
   - When active (`connected === true`), it fetches the authenticated student profile via `GET /api/profile`, extracting student name, student ID, and metadata.
   - When logging in via `LoginModal`, `login()` forwards credentials (`username`, `password`, `program`) to `POST /api/auth/login`. On credential rejection or error, it returns the Thai error message; on success, it updates state and auto-closes the modal.
   - `logout()` calls `POST /api/auth/logout`, clearing in-memory sessions and resetting the state.

3. **Form Metadata & Course Section Queries**:
   - Upon authentication, `fetchFormControls()` fetches `/api/sections`, populating `form.controls` to dynamically populate Year and Semester options.
   - When searching courses in `CourseExplorer`, `searchSections()` dispatches tokens to `POST /api/sections/query`, setting `liveUrsaCourses` in state while rendering the component-scoped loading backdrop.

4. **Timetable Grid Interaction & Ghost Preview Engine**:
   - `TimetableGrid` renders solid Apple blue cards for enrolled courses and outlined ghost cards for unselected search results.
   - *Ghost Preview Exclusions*: Sections are automatically excluded from ghost rendering if the course is already enrolled or if the time slot conflicts with an existing enrolled section.
   - *Bi-directional Hover Sync*: Hovering ghost cards highlights the matching course in `ActiveCoursesList` and table views.
   - *Enrollment / Removal*: Clicking a ghost card enrolls the section; clicking an enrolled card or its 'X' button removes it.
   - *Conflict Pulse & Banner*: Conflicting overlapping time slots trigger red animations (`conflict-pulse`) and render `ConflictBanner`.

5. **Multi-Plan Persistence & Export**:
   - Schedules are loaded and stored under `bu-planer:schedules:v1` in `localStorage`.
   - `CopySecModal` formats enrolled courses into URSA registration copy text and triggers celebratory `canvas-confetti`.

---

## 3. Caveats & Assumptions

1. **ColdFusion Session Lifetime**:
   - Upstream URSA ColdFusion sessions expire in 60 minutes. If expired, API endpoints return 401, triggering `useUrsaAuth` to transition to `connected: false` so the user can re-authenticate.
2. **Offline & Fallback Planning**:
   - In disconnected mode, the application gracefully operates using `MOCK_COURSES`, enabling users to test timetable drafting offline.
3. **SSRF Guard**:
   - Form targets submitted to `/api/sections/query` are validated to strictly match `https://ursa2.bu.ac.th/seat/`.

---

## 4. Conclusion

Milestone 4 (Frontend UI Integration & State Management) is fully completed with genuine logic, strict type safety, real session lifecycle management, live timetable rendering, interactive ghost previews, and multi-plan persistence.

---

## 5. Verification Method

To independently verify the Milestone 4 frontend implementation:

1. **Verify TypeScript & Production Build**:
   ```powershell
   npm run build
   ```
   *Expected Result*: Exit code 0, Turbopack compiles successfully with 0 errors.

2. **Verify Auth Flow & Live Header Badge**:
   - Start development server: `npm run dev`
   - Open `http://localhost:3000`
   - Verify Header shows gray pill `"ยังไม่ได้เชื่อม URSA"` and `"เชื่อม URSA"` button.
   - Click `"เชื่อม URSA"`, enter credentials, click submit -> Verify spinner `"กำลังเชื่อมต่อ..."`.
   - On success -> Verify Header displays green pulsing badge `"เชื่อมต่อ URSA แล้ว"` with Student Name and Student ID.

3. **Verify Section Search & Ghost Previews**:
   - In `CourseExplorer`, search for `"CS441 CS446"`.
   - Verify loading overlay covers the card during query.
   - Verify unselected sections appear as outlined ghost preview cards on the timetable grid.
   - Click a ghost preview card -> Verify it becomes a solid blue enrolled card and moves to `EnrolledCoursesTable`.

4. **Verify Conflict Detection & Persistence**:
   - Enroll two sections on the same day and overlapping time.
   - Verify `ConflictBanner` appears and cards pulse with red conflict animation.
   - Switch between Plan A and Plan B, refresh browser -> Verify plans are preserved via `bu-planer:schedules:v1`.
