# Target Codebase Comprehensive Analysis Report

**Project**: BU Course Schedule Planner (`quick-chandrasekhar`)  
**Investigator**: Explorer 2 (Target Codebase Investigator)  
**Date**: 2026-08-20 / 2026-08-21  
**Target Root**: `c:\Users\Nisha\antigravity\quick-chandrasekhar`

---

## 1. Overall Project Structure & Architecture

### 1.1 Core Stack
- **Framework**: Next.js **16.3.1** (App Router, Turbopack enabled)
- **React**: React **19.2.8** & React DOM **19.2.8**
- **Styling**: Tailwind CSS **v4** (`@tailwindcss/postcss: ^4`, `@import "tailwindcss"` in `src/app/globals.css`)
- **Typography & Theme**: Apple Human Interface Guidelines (HIG) theme:
  - Canvas: `#F5F5F7`
  - Cards: `#FFFFFF` with Apple hairline borders (`border-black/[0.06]`)
  - Primary Accent: Apple Action Blue (`#0071E3`, hover `#0077ED`)
  - Fonts: Prompt font family (Thai + Latin support) and Apple SF Pro typography hierarchy (`apple-headline`, `apple-subheadline`)
- **Icons & Extras**: `lucide-react` (v1.33.0), `canvas-confetti` (v1.9.4), `html-to-image` (v1.11.13)

### 1.2 Directory Layout
```
c:\Users\Nisha\antigravity\quick-chandrasekhar\
├── package.json
├── tsconfig.json
├── next.config.ts
├── eslint.config.mjs
├── postcss.config.mjs
├── AGENTS.md
├── DESIGN.md
├── src/
│   ├── app/
│   │   ├── favicon.ico
│   │   ├── globals.css           # Tailwind v4 theme, fonts, apple utilities
│   │   ├── layout.tsx            # Root layout with Prompt Google Font
│   │   └── page.tsx              # Main timetable planner page (Client Component)
│   ├── components/
│   │   ├── ActiveCoursesList.tsx # List of active courses with status pills & hover effects
│   │   ├── ConflictBanner.tsx    # Conflict alert banner with affected sections
│   │   ├── CopySecModal.tsx      # Modal to export & copy section codes to clipboard
│   │   ├── CourseExplorer.tsx    # Academic year/semester selector & course search textarea
│   │   ├── EnrolledCoursesTable.tsx # Apple-styled table of enrolled sections
│   │   ├── ExportModal.tsx       # PNG & ICS calendar export modal
│   │   ├── Header.tsx            # Header component with BU branding
│   │   ├── LoginModal.tsx        # URSA student SSO login modal
│   │   ├── PlanSwitcher.tsx      # Plan tabs switcher (A, B, C...)
│   │   ├── SelectedCoursesSummary.tsx # Tuition estimate & credit progress summary
│   │   ├── TimetableGrid.tsx     # 6-day timetable with integrated browser tab bar
│   │   ├── UnselectedCoursesTable.tsx # Apple-styled table of unselected searched courses
│   │   └── UrsaSectionTable.tsx  # Legacy dark-styled section table component
│   ├── data/
│   │   └── mockCourses.ts        # Mock course catalog (CS441, CS446, CS422, CS430, CS448, EN103)
│   ├── types/
│   │   └── schedule.ts           # Data interfaces: Course, Section, PlanData, TimeConflict, etc.
│   └── utils/
│       └── scheduleUtils.ts      # Conflict detection, time arithmetic, copy text generation
```

---

## 2. Component Inventory & State Architecture

### 2.1 State Management Current State
- **Current Paradigm**: Pure React State (`useState`, `useMemo`, `useRef`) in `src/app/page.tsx`. No global store (no Zustand, Redux, or React Context).
- **Core States in `src/app/page.tsx`**:
  | State Variable | Type | Description |
  |---|---|---|
  | `plans` | `Record<PlanId, PlanData>` | Dictionary of schedule plans (`planA`, `planB`, `planC`...). Each plan has an array of `SelectedCourseItem`. |
  | `activePlan` | `PlanId` (`string`) | Currently selected plan ID (defaults to `'planA'`). |
  | `searchQuery` | `string` | Query string of course codes (defaults to `'CS422 CS430 CS441 CS446 CS448 EN103'`). |
  | `hoveredCourseId`| `string \| null` | For bidirectional hover highlighting between course lists and timetable cards. |
  | `isCopyModalOpen`| `boolean` | Controls visibility of `CopySecModal`. |
  | `isLoginModalOpen`| `boolean` | Controls visibility of `LoginModal`. |
  | `searchedCourses`| `Course[]` (`useMemo`) | Filters `MOCK_COURSES` by matching space-separated tokens from `searchQuery`. |
  | `previewSections`| `{course, section}[]` (`useMemo`)| Generates preview/ghost section cards for unselected courses. |
  | `conflicts` | `TimeConflict[]` | Evaluated via `detectConflicts(currentItems)` on each render. |

### 2.2 User Session & Authentication State (Gap Analysis)
- **Current State**:
  - `LoginModal.tsx` contains dummy local state (`studentId`, `password`, `isSuccess`) and uses a simulated `setTimeout(() => onClose(), 1500)`.
  - There is currently **no authentication state** stored in `page.tsx` or in cookies/localStorage.
  - The login button in `page.tsx` (lines 212-218) statically displays "เข้าสู่ระบบ" regardless of auth status.
- **Required URSA Integration**:
  - Global or lifted user session state: `{ isAuthenticated: boolean; studentId?: string; studentName?: string; isLoading: boolean }`.
  - On mount, query `GET /api/auth/status` (and `GET /api/profile`) to hydrate session.
  - Upon successful login in `LoginModal.tsx`, invoke `POST /api/auth/login`, fetch profile, and update session state.
  - Render user profile pill (Student ID, Name, Logout button) in header or top-right action area when authenticated.

### 2.3 Component Survey
1. **`LoginModal.tsx` (`src/components/LoginModal.tsx`)**:
   - Modal with Apple frosted blur backdrop and rounded card.
   - Form fields: `User Name URSA` (`studentId`) and `Password URSA` (`password`).
   - Needs: integration with `POST /api/auth/login`, error message display for invalid credentials, loading spinner on submit.
2. **`CourseExplorer.tsx` (`src/components/CourseExplorer.tsx`)**:
   - Inputs: `academicYear` dropdown, `semester` dropdown, multiline `textarea` for course codes.
   - Features: Clear button, component-scoped loading overlay (`isLoading`), search status indicator.
   - Needs: integration with `POST /api/sections/query` or triggering query handler in parent.
3. **`ActiveCoursesList.tsx` (`src/components/ActiveCoursesList.tsx`)**:
   - Lists searched courses with course code, title, and status pill (`Sec <num>` or `ยังไม่เลือก`).
   - Bidirectional hover highlight (`onMouseEnter` / `onMouseLeave`).
   - Header actions: `Copy Code & Sec` modal trigger and `Reset Plan` button.
4. **`TimetableGrid.tsx` (`src/components/TimetableGrid.tsx`)**:
   - Integrated browser-style tabs for plans with Apple inverted curved SVG fillets.
   - Supports adding, renaming, and deleting plans.
   - Timetable grid with 11 hourly slots (08:00 - 19:00) across 6 days (MON-SAT).
   - Card positioning logic:
     - **Enrolled cards**: Solid Apple blue `#0071E3` (or red `#FF3B30` with `conflict-pulse` if conflicting).
     - **Ghost preview cards**: Outlined Apple blue card for unselected courses, clickable to enroll directly into the active plan.
     - Automatic column clustering for overlapping sections.
5. **`EnrolledCoursesTable.tsx` & `UnselectedCoursesTable.tsx`**:
   - Clean Apple HIG tables presenting section details: `Section`, `Seat(s)`, `Status`, `Type` (LECT/LAB), `Day`, `Time`, `Room`, `Remark2`, `Remark1`, `Examination`, `Restriction`.
   - Replaces old dark-themed `UrsaSectionTable.tsx`.
6. **`ConflictBanner.tsx` (`src/components/ConflictBanner.tsx`)**:
   - Displayed at top of page when `conflicts.length > 0`. Lists specific course codes, section numbers, day, and overlapping time range.
7. **`CopySecModal.tsx` & `ExportModal.tsx`**:
   - `CopySecModal`: Generates formatted URSA registration string (`+ Plan A\nCS441 ... : 3271 : 09:00-12:00`), triggers confetti.
   - `ExportModal`: Generates PNG via `html-to-image` or `.ics` iCalendar file for Google/Apple Calendar.

---

## 3. Data Structures, Types & Conflict Detection

### 3.1 Type Definitions (`src/types/schedule.ts`)
```typescript
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT';

export interface Section {
  sectionNo: string;
  day: DayOfWeek;
  startTime: string; // "09:00"
  endTime: string;   // "12:00"
  room: string;      // "C2-304"
  instructor: string;
  campus: string;
  totalSeats: number;
  availableSeats: number;
  midtermDate?: string;
  finalDate?: string;
  remark1?: string;
  remark2?: string;
  examination?: string;
  restriction?: string;
}

export interface Course {
  id: string;
  code: string;       // "CS441"
  nameTh: string;
  nameEn: string;
  credits: number;
  category: 'IT_COMPUTING' | 'BU_GE' | 'FREE_ELECTIVE' | 'CORE_MAJOR';
  faculty: string;
  description: string;
  prerequisite?: string;
  color: string;      // Hex color for calendar card
  sections: Section[];
}

export interface SelectedCourseItem {
  course: Course;
  section: Section;
  addedAt: number;
}

export interface PlanData {
  id: string;
  name: string;
  items: SelectedCourseItem[];
}

export interface TimeConflict {
  courseA: Course;
  sectionA: Section;
  courseB: Course;
  sectionB: Section;
  day: DayOfWeek;
  timeRange: string;
}
```

### 3.2 Time Slot & Conflict Detection Logic (`src/utils/scheduleUtils.ts`)
- **Time Representation**: 24-hour format `"HH:mm"`, converted to minutes from 00:00 via `timeToMinutes(timeStr)`.
- **Interval Overlap Formula**:
  $$\text{Overlap} \iff \max(\text{startA}, \text{startB}) < \min(\text{endA}, \text{endB})$$
- Evaluated for all pairs on the same day (`itemA.section.day === itemB.section.day`).
- Highly performant ($O(n^2)$ where $n \le 15$ courses per plan).

---

## 4. API Routes & Mock Data Survey

### 4.1 Existing API Routes
- **Current State**: Directory `src/app/api/` does not yet exist. All data is statically pulled from `src/data/mockCourses.ts`.
- **Planned Endpoints (Requirements R1, R2, R3)**:
  1. `POST /api/auth/login`
     - Upstream target: `https://ursa2.bu.ac.th/SetFullId.cfm`
     - Form parameters: `liveid`, `inter_passwd`, `option1`
     - Returns HTTP-only session cookie (`buplaner_session`).
  2. `GET /api/auth/status`
     - Checks whether `buplaner_session` cookie is present and valid.
  3. `POST /api/auth/logout`
     - Clears `buplaner_session` cookie.
  4. `GET /api/profile`
     - Upstream target: `https://ursa2.bu.ac.th/remark/remark.cfm`
     - Decodes windows-874 HTML payload to UTF-8.
     - Parses student ID (`0000000000`) and Student Name (Thai/English).
  5. `GET /api/sections`
     - Proxies form metadata from `https://ursa2.bu.ac.th/seat/seat1.cfm` (academic years and semesters).
  6. `POST /api/sections/query`
     - Upstream target: `https://ursa2.bu.ac.th/seat/seat1.cfm` (or POST search endpoint)
     - Decodes windows-874 payload to UTF-8.
     - Parses HTML table into structured `Course[]` and `Section[]` JSON.

---

## 5. Dependencies & Library Requirements

### 5.1 Currently Installed (`package.json`)
```json
{
  "dependencies": {
    "canvas-confetti": "^1.9.4",
    "html-to-image": "^1.11.13",
    "lucide-react": "^1.33.0",
    "next": "16.3.1",
    "react": "19.2.8",
    "react-dom": "19.2.8"
  },
  "devDependencies": {
    "@tailwindcss/postcss": "^4",
    "@types/canvas-confetti": "^1.9.0",
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "eslint-config-next": "16.3.1",
    "tailwindcss": "^4",
    "typescript": "^5"
  }
}
```

### 5.2 Missing Dependencies Required for Integration
1. **`iconv-lite`** & **`@types/iconv-lite`**:
   - **Reason**: Bangkok University URSA servers respond in `windows-874` (TIS-620 extended) character encoding. Node.js native `TextDecoder('windows-874')` may have platform quirks; `iconv-lite` is the industry standard for reliable decoding of raw binary buffers into UTF-8.
2. **`cheerio`** (or built-in parser):
   - **Reason**: Server-side parsing of URSA HTML pages (`remark.cfm`, `seat1.cfm`) to extract table rows, seat numbers, course details, and form fields.

---

## 6. Next.js 16 / Turbopack Build & Rule Compliance

### 6.1 Build Health Check
- `npm run build` executed and passed cleanly:
  - Next.js version: **16.3.1 (Turbopack)**
  - TypeScript compilation: 0 errors
  - Static page generation: 100% success (0 errors)

### 6.2 Next.js 16 App Router Route Handlers Rules
1. **Async Cookies API**: In Next.js 15 & 16, `cookies()` from `next/headers` is an asynchronous function (`const cookieStore = await cookies()`).
2. **Dynamic Route Handlers**: Route handlers that proxy live data or read cookies must be marked with `export const dynamic = 'force-dynamic'` to prevent Turbopack from attempting static pre-rendering at build time.
3. **Response Headers**: When setting session cookies on `NextResponse.json(...)`, use standard `response.cookies.set(...)` with `httpOnly: true`, `sameSite: 'lax'`, `path: '/'`, `secure: process.env.NODE_ENV === 'production'`.

---

## 7. Recommended Integration Blueprint

1. **Package Installation**:
   - Install `iconv-lite`, `@types/iconv-lite`, and `cheerio`.
2. **Backend Route Handlers (`src/app/api/`)**:
   - Create `src/lib/ursaClient.ts` containing network fetch utilities, cookie jar handling, and `windows-874` decoding.
   - Implement `src/app/api/auth/login/route.ts`, `src/app/api/auth/status/route.ts`, `src/app/api/auth/logout/route.ts`.
   - Implement `src/app/api/profile/route.ts`.
   - Implement `src/app/api/sections/route.ts` and `src/app/api/sections/query/route.ts`.
3. **Frontend Integration**:
   - Introduce session state in `src/app/page.tsx` (or React Context).
   - Connect `LoginModal.tsx` to `/api/auth/login`.
   - Connect `CourseExplorer.tsx` to `/api/sections/query` with live loading overlay.
   - Display student profile (ID and Name) and Logout action in the top navigation / sidebar.
   - Connect live section data into `EnrolledCoursesTable`, `UnselectedCoursesTable`, and `TimetableGrid`.
