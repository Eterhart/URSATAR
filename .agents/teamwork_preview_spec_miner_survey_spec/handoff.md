# Handoff Report: Specification Mining for URSA Live Integration

**Agent**: Spec Miner (Requirements & Interface Architect)  
**Workspace**: `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec`  
**Date**: 2026-08-21T03:09:55+07:00  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Reference Implementation (`C:\Users\Nisha\Downloads\ScheduleBU`)**:
   - `server.js` (lines 16-30): Demonstrates URSA multi-step authentication via `fetch('https://ursa2.bu.ac.th/seat/seat1.cfm', { redirect: 'manual' })`, followed by POST to `https://ursa2.bu.ac.th/SetFullId.cfm` with `liveid`, `inter_passwd`, and `option1` (1 = regular, 2 = buic). Follows up to 5 HTTP 30x redirects while collecting cookies via `response.headers.getSetCookie()`. Checks for rejection using `/Access Denied|User name.*Password/i` on `windows-874` decoded text.
   - `server.js` (lines 35-54): Implements `/api/auth/login`, `/api/auth/status`, `/api/sections`, `/api/sections/query`, and `/api/profile`. Session token stored with `buplaner_session` cookie (`HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`).
   - `app.js` (line 59): Profile parsing queries `/api/profile` (`https://ursa2.bu.ac.th/remark/remark.cfm`), scans for table with `Grade Report`, `Student ID`, and `Name`, and extracts `studentId` and `studentName`.
   - `app.js` (lines 30-33, 50-54): Sections query parses `/seat/seat1.cfm` form controls (`acdyr`, `sem`, `course_code`, `option1`) and renders results table (`Section`, `Seat(s)`, `Status`, `Type`, `Day`, `Time`, `Room`, `Remark2`, `Remark1`, `Examination`, `Restriction`).

2. **Target Codebase (`c:\Users\Nisha\antigravity\quick-chandrasekhar`)**:
   - Framework: Next.js 16.3.1 (App Router), React 19.2.8, Tailwind CSS v4, Lucide React, Canvas Confetti.
   - Currently, `src/app/api/` does not yet exist. The frontend in `src/app/page.tsx` uses mock data (`src/data/mockCourses.ts`) and local state.
   - UI Components: `src/components/LoginModal.tsx`, `src/components/CourseExplorer.tsx`, `src/components/TimetableGrid.tsx`, `src/components/EnrolledCoursesTable.tsx`, `src/components/UnselectedCoursesTable.tsx`, `src/components/ActiveCoursesList.tsx`, `src/components/Header.tsx`, `src/components/ConflictBanner.tsx`, `src/components/CopySecModal.tsx`.
   - Data Types: `src/types/schedule.ts` defines `Course`, `Section`, `DayOfWeek` (`'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'`), `PlanData`, `TimeConflict`.

---

## 2. Logic Chain

1. **Step 1: Protocol Extraction & Interface Standardization**:
   - By analyzing `ScheduleBU/server.js`, we extracted the exact upstream URSA endpoints:
     - Auth: `https://ursa2.bu.ac.th/SetFullId.cfm`
     - Profile: `https://ursa2.bu.ac.th/remark/remark.cfm`
     - Sections: `https://ursa2.bu.ac.th/seat/seat1.cfm`
   - We formalized the Next.js App Router Route Handler interfaces for `/api/auth/login`, `/api/auth/status`, `/api/auth/logout`, `/api/profile`, `/api/sections`, and `/api/sections/query`.

2. **Step 2: Encoding & Security Specifications**:
   - URSA transmits ColdFusion HTML in `windows-874` encoding. The backend must decode all raw binary buffers using `new TextDecoder('windows-874').decode(arrayBuffer)`.
   - Target URLs for `/api/sections/query` must be validated against `https://ursa2.bu.ac.th/seat/` to prevent SSRF vulnerabilities.
   - The session token must be transmitted via HTTP-only, SameSite=Strict cookies with a 1-hour TTL.

3. **Step 3: Data Parsing & Normalization**:
   - The HTML table parser extracts 11 columns from `/seat/seat1.cfm` and normalizes Thai/English day strings into `DayOfWeek` and time strings into `HH:MM` start/end format.
   - The parser computes `availableSeats` and `totalSeats`, flagging sections with 0 seats as full (`"เต็ม"`).

4. **Step 4: Comprehensive Feature & Test Matrix Generation**:
   - We mapped 36 discrete features across R1, R2, R3, and R4.
   - We designed 14 edge case scenarios and 13 E2E test cases covering login success/failure, profile decoding, section parsing, SSRF protection, ghost previews, conflict detection, and Next.js production builds.

---

## 3. Caveats

1. **URSA Network Availability**: During offline testing or when URSA is under maintenance, mock fixtures or recorded HTML fixtures mirroring `ScheduleBU` should be used for unit testing.
2. **Session Persistence**: The in-memory session map in Node.js server memory is optimal for single-instance Next.js servers; for distributed multi-instance deployments, an encrypted stateless cookie (JWT/AES-GCM) or Redis store can be used.

---

## 4. Conclusion

The specification document `spec.md` is complete, authoritative, and immediately actionable for implementation agents. It provides all route signatures, request/response formats, encoding decoders, DOM parsing selectors, error handlers, and frontend integration hooks required to fulfill all acceptance criteria for R1, R2, R3, and R4.

---

## 5. Verification Method

To verify the specification artifacts:
1. View `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`.
2. Check that all 4 requirement groups (R1, R2, R3, R4) are covered with exact payload schemas, HTTP status codes, and TypeScript types.
3. Validate that the Feature Inventory contains all 36 discrete features and the E2E verification matrix specifies clear pass/fail criteria.
