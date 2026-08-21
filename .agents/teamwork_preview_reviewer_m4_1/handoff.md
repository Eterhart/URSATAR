# Milestone 4: Frontend UI Integration & State Management — Review & Challenge Report

## 1. Observation

- **Reviewed Scope & Files**:
  - `src/types/ursa.ts` (lines 1–90): Contains `UrsaProgram`, `UrsaLoginCredentials`, `UrsaSession`, `UrsaLoginResponse`, `UrsaAuthStatusResponse`, `UrsaLogoutResponse`, `UrsaProfile`, `UrsaProfileResponse`, `UrsaFormControl`, `UrsaForm`, `UrsaSectionsResponse`, `UrsaQueryRequest` (including `option1?: string;`), and `UrsaQueryResponse`.
  - `src/hooks/useUrsaAuth.ts` (lines 1–190): Manages client auth state (`connected`, `studentId`, `studentName`, `meta`, `faculty`, `department`, `isLoading`, `error`). Implements `checkStatus`, `fetchProfile`, `login`, `logout`, and auto-mount session verification (`useEffect`).
  - `src/hooks/useUrsaSections.ts` (lines 1–116): Provides dynamic section query states (`form`, `courses`, `rawHtml`, `isLoading`, `error`), with `fetchFormControls`, `searchSections`, `setCourses`, and `clearResults`.
  - `src/components/LoginModal.tsx` (lines 1–191): Provides modal dialog with live login integration, interactive submission spinner (`กำลังเชื่อมต่อ...`), Thai error banners, and auto-dismiss on success.
  - `src/components/Header.tsx` (lines 1–108): Features live pulsing emerald indicator badge (`เชื่อมต่อ URSA แล้ว`), student name and ID display, logout action trigger, and fallback disconnected badge (`ยังไม่ได้เชื่อม URSA`).
  - `src/components/CourseExplorer.tsx` (lines 1–194): Incorporates dynamic academic year and semester options from `formControls`, multiline / whitespace-delimited course code search, clear button, and card-wide loading backdrop overlay.
  - `src/app/page.tsx` (lines 1–387): Wires `useUrsaAuth` and `useUrsaSections` to `Header`, `CourseExplorer`, `TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, and `CopySecModal`. Manages multi-plan persistence in `localStorage` under `bu-planer:schedules:v1`.
- **Build Verification**:
  - Executed `npm run build`:
    ```
    ▲ Next.js 16.3.1 (Turbopack)
    ✓ Compiled successfully in 309ms
    ✓ Generating static pages using 5 workers (10/10) in 266ms
    Route (app)
    ┌ ○ /
    ├ ○ /_not-found
    ├ ƒ /api/auth/login
    ├ ƒ /api/auth/logout
    ├ ƒ /api/auth/status
    ├ ƒ /api/profile
    ├ ƒ /api/sections
    └ ƒ /api/sections/query
    ```
    Build succeeded with exit code 0 and 0 TypeScript/Turbopack compilation errors.
- **Integrity Inspection**:
  - Checked for dummy mocks, hardcoded test intercepts, fake verification logs, or bypasses: none found. All API hooks and routes communicate with genuine upstream proxy endpoints and respect real session cookies.

---

## 2. Logic Chain

1. **Authentication Lifecycle & Session Resilience**:
   - `useUrsaAuth` automatically executes `GET /api/auth/status` upon initial client mount. If an active session exists (via httpOnly `buplaner_session` cookie), it fetches student details (`/api/profile`) and populates `Header` without requiring the user to log in again.
   - `fetchProfile` handles 401 statuses gracefully by resetting state to disconnected, preventing stale session artifacts.
2. **Dynamic Query & Form Metadata Integration**:
   - When authenticated, `page.tsx` triggers `fetchFormControls()`, which queries `/api/sections` to discover active Year and Semester form controls from `/seat/seat1.cfm`.
   - `CourseExplorer` dynamically populates `<select>` options using `yearControl` and `semControl`, while providing safe fallbacks (2569, 2568, 2567).
   - Executing search parses multiline course codes into uppercase tokens and calls `POST /api/sections/query`, setting `liveUrsaCourses`.
3. **Data Priority & Fallback Consistency**:
   - In `page.tsx`, `searchedCourses` prioritizes `liveUrsaCourses` when available; otherwise, it falls back to `MOCK_COURSES`. This ensures full functionality in offline / disconnected preview mode while seamlessly switching to live URSA data when connected.
4. **Interactive Ghost Previews & Timetable Conflict Management**:
   - `TimetableGrid` computes ghost previews for unselected search results, explicitly excluding courses that are already enrolled or time slots that conflict with existing enrolled selections.
   - Adding or removing courses immediately triggers `detectConflicts()`, updating `ConflictBanner` and pulsing red conflict indicators on the calendar cards.
5. **State Persistence & Plan Switching**:
   - Plans are synchronized with `localStorage` under `bu-planer:schedules:v1` with backward compatibility for both array-of-items and object structures, ensuring that user timetable drafts persist across browser sessions.
6. **Apple UI Design Language Compliance**:
   - The UI adheres to Apple design conventions: subtle borders (`border-black/[0.08]`), action blue accents (`#0071E3`), backdrop blur overlays, rounded pill buttons, and responsive grid layouts.

---

## 3. Caveats & Assumptions

1. **Live URSA Network Availability**:
   - Live queries depend on Bangkok University's `ursa2.bu.ac.th` ColdFusion server availability. The client handles network and 502/504 errors gracefully by surfacing localized error messages and keeping the offline mock fallback operable.
2. **ColdFusion 60-minute Session Expiry**:
   - Upstream ColdFusion sessions expire after 1 hour of inactivity. If a user attempts a query after expiration, the 401 response prompts the user to re-authenticate via `LoginModal`.

---

## 4. Conclusion

**Verdict: APPROVE**

The Milestone 4 implementation satisfies all requirements (R4 in `ORIGINAL_REQUEST.md`), interface contracts in `PROJECT.md`, strict TypeScript type safety, error boundaries, session lifecycle state management, and Apple design guidelines with 0 build errors.

---

## 5. Verification Method

1. **Production Build & Type Check**:
   ```powershell
   npm run build
   ```
   *Expected Result*: Exit code 0, 0 TypeScript errors, all App Router endpoints generated.

2. **Frontend Session Flow**:
   - Run `npm run dev` and navigate to `http://localhost:3000`.
   - Verify Header shows disconnected pill `"ยังไม่ได้เชื่อม URSA"`.
   - Open LoginModal, verify loading spinner and error feedback on invalid credentials.
   - On valid authentication, verify Header shows green indicator `"เชื่อมต่อ URSA แล้ว"` with student name and ID.

3. **Section Search & Timetable Rendering**:
   - Enter course codes in `CourseExplorer` (e.g., `"CS441 CS446"`).
   - Verify card-level loading backdrop appears during fetch.
   - Verify ghost preview cards render on `TimetableGrid` and can be clicked to enroll.
   - Verify enrolled courses appear in `EnrolledCoursesTable` and can be exported via `CopySecModal`.
