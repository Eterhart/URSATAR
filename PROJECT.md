# Project: URSA Live Integration & Timetable Planner

## Architecture
```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (Client)                       │
│  - LoginModal / Auth State Hook (useUrsaAuth)                          │
│  - Header (User Profile & Live Connection Status)                      │
│  - CourseExplorer (URSA Term & Multi-Course Query)                     │
│  - TimetableGrid (Ghost Previews, Solid Cards, Conflict Engine)        │
│  - EnrolledCoursesTable & UnselectedCoursesTable (Live URSA Data)      │
│  - PlanSwitcher & CopySecModal (Multi-plan Storage & Export)           │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (JSON / HTTP-only Session Cookie)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Next.js App Router (Backend)                      │
│                                                                        │
│  /api/auth/login     /api/auth/status     /api/auth/logout             │
│  /api/profile        /api/sections        /api/sections/query          │
│                                                                        │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │ Core Modules (src/lib/ursa/):                                    │  │
│  │ - sessionStore.ts   (1h TTL, in-memory / crypto session map)    │  │
│  │ - client.ts         (Multi-hop redirect & ColdFusion cookie jar) │  │
│  │ - decoder.ts        (windows-874 binary -> UTF-8 decoder)        │  │
│  │ - profileParser.ts  (HTML Grade Report DOM/regex parser)         │  │
│  │ - sectionParser.ts  (HTML Section Table DOM/regex parser)        │  │
│  └──────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ (HTTPS, windows-874, Set-Cookie)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                  Bangkok University URSA Upstream                      │
│                      https://ursa2.bu.ac.th                            │
│  - /SetFullId.cfm         (Authentication Endpoint)                    │
│  - /remark/remark.cfm     (Student Profile & Grade Report)             │
│  - /seat/seat1.cfm        (Live Course & Section Availability)         │
└────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source |
|---|---------|-------------|-----------|--------|
| 1 | Upstream Landing Handshake | Fetch `/seat/seat1.cfm` to negotiate initial ColdFusion cookies (`CFID`, `CFTOKEN`) | M1 | survey |
| 2 | URSA SetFullId Proxy | Forward credentials (`liveid`, `inter_passwd`, `option1`) to `https://ursa2.bu.ac.th/SetFullId.cfm` | M1 | survey |
| 3 | Multi-hop Redirect Tracker | Follows up to 5 HTTP 30x redirects while accumulating cookies | M1 | survey |
| 4 | Windows-874 Text Decoding | Decodes binary response buffer into UTF-8 Thai text using `TextDecoder('windows-874')` | M1 | survey |
| 5 | Credential Rejection Detector | Detects login failure via regex test `/Access Denied\|User name.*Password/i` | M1 | survey |
| 6 | Session Token Generation | Generates cryptographically secure base64url session ID | M1 | survey |
| 7 | HTTP-Only Session Cookie | Sets `buplaner_session` cookie with Strict SameSite and 1h Max-Age | M1 | survey |
| 8 | Auth Status Verifier | Checks existence and TTL (< 1 hour) of active session (`/api/auth/status`) | M1 | survey |
| 9 | Session Logout & Invalidation | Clears session from memory and sets Max-Age=0 cookie (`/api/auth/logout`) | M1 | survey |
| 10 | Profile Page Fetcher | Proxies GET request to `/remark/remark.cfm` with active URSA cookie | M2 | survey |
| 11 | Grade Report Table Extractor | Locates table with `/Grade Report/i`, `/Student ID/i`, `/Name/i` | M2 | survey |
| 12 | Student Name & ID Parsing | Extracts name and studentId from adjacent cells in Grade Report table | M2 | survey |
| 13 | Profile API Endpoint | `/api/profile` returning `{ ok: true, studentId, studentName }` | M2 | survey |
| 14 | Non-blocking Profile Fallback | Gracefully handles missing profile without failing client timetable | M2 | survey |
| 15 | Form Metadata Retrieval | Proxies GET `/seat/seat1.cfm` to discover term/year form controls (`/api/sections`) | M3 | survey |
| 16 | Section Query Proxy | Proxies GET/POST queries to `/seat/seat1.cfm` with search fields (`/api/sections/query`) | M3 | survey |
| 17 | Upstream URL Whitelist Validation | Validates action origin matches `https://ursa2.bu.ac.th/seat/` | M3 | survey |
| 18 | Section Table DOM Filter | Finds table containing `/Seat\(s\)/i` and `/Status/i` | M3 | survey |
| 19 | Course Code Pattern Extractor | Extracts course code using regex `/\b[A-Z]{2,4}\d{3}\b/` | M3 | survey |
| 20 | Seat Availability Parser | Extracts available seats and total seats (e.g. `12 / 40`, `0 / 35`) | M3 | survey |
| 21 | Day of Week Normalizer | Maps Thai/English day names to standard `DayOfWeek` (`MON`..`SAT`) | M3 | survey |
| 22 | Time Range Parser | Parses start/end times (`HH:MM - HH:MM` or `HH.MM`) | M3 | survey |
| 23 | Room & Type Classifier | Extracts room and classifies as `LAB` if room contains `"lab"` or `"LAB"` | M3 | survey |
| 24 | Exam & Restrictions Extractor | Extracts midterm/final exam schedules and enrollment restrictions | M3 | survey |
| 25 | LoginModal Live Auth Integration | Connects `LoginModal` to `/api/auth/login`, shows loading & error states | M4 | survey |
| 26 | Live Header Profile & Connection Badge | Displays student name, ID, and live connection status pill in Header | M4 | survey |
| 27 | CourseExplorer Query Integration | Multi-course search queries live `/api/sections/query` with loading overlay | M4 | survey |
| 28 | Live Ghost Previews in TimetableGrid | Unselected live sections render as interactive ghost cards | M4 | survey |
| 29 | Solid Enrolled Cards & Removal | Enrolled courses render with solid Apple blue cards and removal button | M4 | survey |
| 30 | Time Conflict Engine with Live Data | Computes time overlaps and triggers red conflict pulse + warning banner | M4 | survey |
| 31 | Tables Live Data Integration | Populates `EnrolledCoursesTable` and `UnselectedCoursesTable` with live sections | M4 | survey |
| 32 | Multi-Plan Storage & Switching | Persists plans in localStorage and switches seamlessly with live courses | M4 | survey |
| 33 | CopySecModal Live Formatting | Exports selected section codes with live course names and times | M4 | survey |
| 34 | Build & TypeScript Conformance | Ensures Next.js Turbopack build succeeds with 0 errors | M5 | survey |
| 35 | Full E2E Test Suite Pass | 100% pass on all 4 Tiers of E2E verification test suite | M5 | survey |
| 36 | Adversarial & Forensic Hardening | Validates edge cases, SSRF guard, encoding robustness, and clean audit | M5 | survey |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| 1 | M1: URSA Auth & Session Proxy | `src/lib/ursa/sessionStore.ts`, `src/lib/ursa/client.ts`, `src/lib/ursa/decoder.ts`, `/api/auth/login`, `/api/auth/status`, `/api/auth/logout` | none | DONE |
| 2 | M2: Student Profile Fetcher | `src/lib/ursa/profileParser.ts`, `/api/profile` | M1 | DONE |
| 3 | M3: Dynamic Course & Section Query | `src/lib/ursa/sectionParser.ts`, `/api/sections`, `/api/sections/query` | M1 | DONE |
| 4 | M4: Frontend Integration & State | `src/hooks/useUrsaAuth.ts`, `src/hooks/useUrsaSections.ts`, `LoginModal`, `Header`, `CourseExplorer`, `ActiveCoursesList`, `TimetableGrid`, `EnrolledCoursesTable`, `UnselectedCoursesTable`, `src/app/page.tsx` | M1, M2, M3 | DONE |
| 5 | M5: E2E Verification & Hardening | Full E2E verification test suite runner, `npm run build` pass, adversarial stress tests, and Forensic Audit pass | M1, M2, M3, M4 | DONE |

## Code Layout
```
src/
├── app/
│   ├── api/
│   │   ├── auth/
│   │   │   ├── login/route.ts
│   │   │   ├── status/route.ts
│   │   │   └── logout/route.ts
│   │   ├── profile/
│   │   │   └── route.ts
│   │   └── sections/
│   │       ├── route.ts
│   │       └── query/route.ts
│   ├── layout.tsx
│   ├── page.tsx
│   └── globals.css
├── components/
│   ├── ActiveCoursesList.tsx
│   ├── ConflictBanner.tsx
│   ├── CopySecModal.tsx
│   ├── CourseExplorer.tsx
│   ├── EnrolledCoursesTable.tsx
│   ├── Header.tsx
│   ├── LoginModal.tsx
│   ├── PlanSwitcher.tsx
│   ├── QuickActionBar.tsx
│   ├── TimetableGrid.tsx
│   └── UnselectedCoursesTable.tsx
├── hooks/
│   ├── useUrsaAuth.ts
│   └── useUrsaSections.ts
├── lib/
│   ├── scheduleUtils.ts
│   └── ursa/
│       ├── client.ts
│       ├── decoder.ts
│       ├── profileParser.ts
│       ├── sectionParser.ts
│       └── sessionStore.ts
└── types/
    ├── schedule.ts
    └── ursa.ts
```

## Interface Contracts

### 1. Auth Module (`/api/auth/*`)
- `POST /api/auth/login`:
  - Request: `{ username: string, password: string, program?: 'regular' | 'buic' }`
  - Response (200): `{ ok: true, connected: true }` + `Set-Cookie: buplaner_session=<token>; Path=/; HttpOnly; SameSite=Strict; Max-Age=3600`
  - Error (401): `{ error: string }`
- `GET /api/auth/status`:
  - Request Cookie: `buplaner_session`
  - Response (200): `{ connected: boolean }`
- `POST /api/auth/logout`:
  - Response (200): `{ ok: true, connected: false }` + `Set-Cookie: buplaner_session=; Path=/; Max-Age=0`

### 2. Profile Module (`/api/profile`)
- `GET /api/profile`:
  - Request Cookie: `buplaner_session`
  - Response (200): `{ ok: true, studentId: string, studentName: string, meta?: string }`
  - Error (401): `{ error: "Connect URSA first" }`

### 3. Section Query Module (`/api/sections/*`)
- `GET /api/sections`:
  - Request Cookie: `buplaner_session`
  - Response (200): `{ ok: true, form: { action: string, controls: UrsaFormControl[] } }`
- `POST /api/sections/query`:
  - Request: `{ academicYear?: string, semester?: string, courseCodes?: string[], action?: string, fields?: Record<string, string> }`
  - Response (200): `{ ok: true, courses: Course[], html?: string }`
