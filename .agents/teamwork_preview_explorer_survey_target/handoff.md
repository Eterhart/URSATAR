# Handoff Report — Explorer 2 (Target Codebase Investigator)

**Working Directory**: `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_survey_target`  
**Target Project**: `c:\Users\Nisha\antigravity\quick-chandrasekhar`  
**Handoff Type**: Hard (Task complete)

---

## 1. Observation

1. **Next.js & Build System**:
   - `package.json` lines 11-18 specifies:
     - `"next": "16.3.1"`
     - `"react": "19.2.8"`
     - `"react-dom": "19.2.8"`
     - `"lucide-react": "^1.33.0"`
     - `"canvas-confetti": "^1.9.4"`
     - `"html-to-image": "^1.11.13"`
   - `package.json` devDependencies lines 19-29 specifies `@tailwindcss/postcss: ^4`, `tailwindcss: ^4`, `typescript: ^5`.
   - `npm run build` command ran successfully with exit code 0:
     ```
     ▲ Next.js 16.3.1 (Turbopack)
     ✓ Compiled successfully in 368ms
     Finished TypeScript in 1718ms ...
     ✓ Generating static pages using 5 workers (4/4) in 777ms
     ```
2. **App Router & Directory Layout**:
   - `src/app/layout.tsx` imports Google Font `Prompt` (subsets: latin, thai) and `globals.css`.
   - `src/app/page.tsx` is a `'use client'` component containing all top-level states: `plans`, `activePlan`, `searchQuery`, `hoveredCourseId`, `isCopyModalOpen`, `isLoginModalOpen`.
   - No route handlers currently exist under `src/app/api/`.
3. **Components & Styling**:
   - UI follows Apple HIG design defined in `src/app/globals.css` (`--apple-canvas: #f5f5f7`, `--apple-card: #ffffff`, `--apple-primary: #0071e3`, `apple-card-light`, `apple-blue-btn`, `apple-headline`, `apple-subheadline`).
   - `src/components/LoginModal.tsx` (lines 11-25) contains dummy local state `studentId`, `password`, `isSuccess` with a 1.5s simulated `setTimeout` timeout and no real API call.
   - `src/components/CourseExplorer.tsx` (lines 17-38) contains `academicYear`, `semester`, and `localInput` with simulated latency of 750ms before calling `onSearchChange(localInput)`.
   - `src/components/TimetableGrid.tsx` (lines 60-645) renders hourly slots (08:00 - 19:00), 6 day columns (MON - SAT), tab bar with SVG curved fillets, ghost preview cards, and solid enrolled cards with conflict animation.
   - `src/components/EnrolledCoursesTable.tsx` & `src/components/UnselectedCoursesTable.tsx` render structured course tables with Section, Seats, Status, Type, Day, Time, Room, Remarks, Exam, Restriction.
4. **Data Models & Conflict Math**:
   - `src/types/schedule.ts` defines `DayOfWeek`, `Section`, `Course`, `SelectedCourseItem`, `PlanData`, `TimeConflict`.
   - `src/utils/scheduleUtils.ts` (lines 32-63) detects conflicts via `Math.max(startA, startB) < Math.min(endA, endB)` on matching `day`.
5. **Missing Packages for URSA Integration**:
   - `iconv-lite` / `@types/iconv-lite` is NOT installed in `package.json`.
   - `cheerio` is NOT installed in `package.json`.

---

## 2. Logic Chain

1. **Premise 1**: The timetable planner currently runs entirely in client-side React state using static mock data from `src/data/mockCourses.ts` and simulated timeouts in `LoginModal` and `CourseExplorer`.
2. **Premise 2**: URSA live integration requires connecting to Bangkok University ColdFusion endpoints (`https://ursa2.bu.ac.th`) that transmit `windows-874` encoded HTML documents with session cookies (`CFID`, `CFTOKEN`, etc.).
3. **Premise 3**: To decode `windows-874` and parse HTML tables server-side in Next.js 16 App Router route handlers, `iconv-lite` and `cheerio` are required dependencies.
4. **Premise 4**: Next.js 16 App Router requires asynchronous cookie access (`await cookies()`) and dynamic handler declarations (`export const dynamic = 'force-dynamic'`) to handle live cookie proxying and prevent static build errors.
5. **Deduction**: The target application architecture is clean, modular, and ready for integration. Creating the route handlers (`/api/auth/*`, `/api/profile`, `/api/sections/*`) and wiring them to the existing `LoginModal`, `CourseExplorer`, and `page.tsx` state will fulfill R1-R4 without requiring structural refactoring of existing calendar components.

---

## 3. Caveats

- **Reference URSA Implementation Details**: Explorer 2 investigated the target Next.js codebase. Specific ColdFusion endpoint URLs, form parameters, and parsing regex/DOM logic from `C:\Users\Nisha\Downloads\ScheduleBU` will be provided by Explorer 1.
- **Client Session Persistence**: Currently, `page.tsx` does not persist plans or session to `localStorage` or server cookies; introducing `GET /api/auth/status` will allow seamless session restoration on page load.
- No other caveats.

---

## 4. Conclusion

- The target codebase is in excellent health: Next.js 16.3.1 with Turbopack, React 19, Tailwind CSS v4, with 0 TypeScript/build errors.
- Component architecture (`TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, `ActiveCoursesList`, `CourseExplorer`, `LoginModal`) is fully prepared to receive real URSA data structures matching the existing `Course` and `Section` interfaces.
- The next implementation phase requires:
  1. Installing `iconv-lite`, `@types/iconv-lite`, and `cheerio`.
  2. Implementing Next.js Route Handlers (`src/app/api/auth/login`, `src/app/api/auth/status`, `src/app/api/auth/logout`, `src/app/api/profile`, `src/app/api/sections`, `src/app/api/sections/query`).
  3. Updating `LoginModal.tsx`, `CourseExplorer.tsx`, and `page.tsx` to bind to live API routes and display authenticated student info.

---

## 5. Verification Method

1. **Verify Target Codebase Analysis Report**:
   - Inspect `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_survey_target\analysis.md`.
2. **Verify Next.js 16 Build & Zero Errors**:
   - Run `npm run build` in `c:\Users\Nisha\antigravity\quick-chandrasekhar`.
   - Observe exit code 0 and successful Turbopack page generation.
3. **Verify Component Interfaces**:
   - Inspect `src/types/schedule.ts`, `src/app/page.tsx`, `src/components/LoginModal.tsx`, `src/components/CourseExplorer.tsx`.
