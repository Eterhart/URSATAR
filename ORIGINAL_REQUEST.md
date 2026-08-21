# Original User Request

## Initial Request — 2026-08-20T20:06:47Z

Integrate the Bangkok University URSA live authentication, student profile parsing, and live section query API into the Next.js timetable planner application based on the reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU`.

Working directory: `c:\Users\Nisha\antigravity\quick-chandrasekhar`
Integrity mode: development

## Requirements

### R1. URSA Authentication & Session Proxy (`/api/auth/login`, `/api/auth/status`, `/api/auth/logout`)
Implement server-side Next.js route handlers that forward login credentials (`liveid`, `inter_passwd`, `option1`) to `https://ursa2.bu.ac.th/SetFullId.cfm`, handling multi-step redirect cookies and encoding (windows-874 / UTF-8). Return an HTTP-only session cookie (`buplaner_session`) and provide endpoints to verify session status and log out.

### R2. Student Profile Fetcher (`/api/profile`)
Create a Next.js route handler that uses the active URSA session to fetch `/remark/remark.cfm`, decodes the windows-874 HTML payload to UTF-8, extracts Student ID and Student Name, and displays them in the application header/sidebar.

### R3. Dynamic Course & Section Query (`/api/sections`, `/api/sections/query`)
Implement route handlers to proxy form metadata from `/seat/seat1.cfm` and handle course/section search queries via POST to `/api/sections/query`. Parse the returned HTML table into structured JSON (course code, name, section number, available seats, total seats, day, time, room, instructor, exam schedule, restrictions) and feed directly into the existing timetable planner UI.

### R4. Frontend Integration with Apple UI Design
Connect the existing `LoginModal`, `CourseExplorer`, and `ActiveCoursesList` components to these real API endpoints, displaying live loading states, session feedback, and real section availability without breaking existing Apple UI design conventions.

## Acceptance Criteria

### Live URSA Auth
- [ ] POST `/api/auth/login` successfully negotiates upstream cookies with `ursa2.bu.ac.th` and returns `buplaner_session`.
- [ ] GET `/api/auth/status` accurately reports connection status.
- [ ] Profile name and Student ID render automatically upon login.

### Section Query & Timetable Rendering
- [ ] Section search queries return parsed JSON with all section slots and live seat availability.
- [ ] Enrolled courses and unselected course tables populate with live URSA data.
- [ ] Time conflict detection and calendar grid work seamlessly with live parsed section data.
- [ ] `npm run build` succeeds with 0 TypeScript/Turbopack errors.
