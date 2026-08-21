# Specification Document: URSA Integration & Timetable Planner Architecture

**Document Version**: 1.0.0  
**Author**: Spec Miner (Requirements & Interface Architect)  
**Target Repository**: `quick-chandrasekhar` (Next.js 16.3.1 App Router + React 19.2.8)  
**Reference Source**: `ScheduleBU` (`C:\Users\Nisha\Downloads\ScheduleBU`) & `https://ursa2.bu.ac.th`  
**Date**: 2026-08-21  

---

## Table of Contents
1. [Executive Summary & System Architecture](#1-executive-summary--system-architecture)
2. [R1: URSA Authentication & Session Proxy Specification](#2-r1-ursa-authentication--session-proxy-specification)
3. [R2: Student Profile Fetcher Specification](#3-r2-student-profile-fetcher-specification)
4. [R3: Dynamic Course & Section Query Specification](#4-r3-dynamic-course--section-query-specification)
5. [R4: Frontend Integration & State Architecture](#5-r4-frontend-integration--state-architecture)
6. [Complete Feature Inventory Table](#6-complete-feature-inventory-table)
7. [Edge Cases & Boundary Conditions](#7-edge-cases--boundary-conditions)
8. [End-to-End (E2E) Verification Matrix](#8-end-to-end-e2e-verification-matrix)

---

## 1. Executive Summary & System Architecture

### 1.1 Purpose
This specification establishes the interface contracts, data models, upstream protocols, encoding pipelines, parsing heuristics, and error-handling mechanisms to integrate live Bangkok University URSA services (`https://ursa2.bu.ac.th`) into the Next.js timetable planner application (`quick-chandrasekhar`).

### 1.2 Architecture Overview
```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js Frontend (Client)                       │
│  - LoginModal / Auth State Hook                                        │
│  - Header (User Profile & Connection Status)                           │
│  - CourseExplorer (URSA Term & Multi-Course Query)                     │
│  - TimetableGrid (Ghost Previews, Solid Cards, Conflict Detection)     │
│  - EnrolledCoursesTable & UnselectedCoursesTable (Live URSA Data)      │
│  - PlanSwitcher & CopySecModal (Multi-plan LocalStorage & Export)      │
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
│  │ Core Modules:                                                    │  │
│  │ - lib/ursa/sessionStore.ts (1h TTL, in-memory / crypto token)    │  │
│  │ - lib/ursa/client.ts       (Multi-hop redirect & cookie jar)     │  │
│  │ - lib/ursa/decoder.ts      (windows-874 binary -> UTF-8)         │  │
│  │ - lib/ursa/parser.ts       (DOM / Regex HTML table parsing)      │  │
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

---

## 2. R1: URSA Authentication & Session Proxy Specification

### 2.1 Upstream Authentication Handshake Protocol
Upstream URSA authentication uses a multi-step session negotiation with 302 redirects and ColdFusion session cookies (`CFID`, `CFTOKEN`, `JSESSIONID`).

```
Next.js Server                       URSA Upstream (https://ursa2.bu.ac.th)
      │                                                │
      ├──── 1. GET /seat/seat1.cfm (Pre-flight) ───────>
      │<─── 2. 200 OK + Set-Cookie: CFID/CFTOKEN ──────┤
      │                                                │
      ├──── 3. POST /SetFullId.cfm (liveid, passwd) ───>
      │<─── 4. 302 Redirect + Set-Cookie (hop 1) ──────┤
      │                                                │
      ├──── 5. GET /redirect/location (Follow) ────────>
      │<─── 6. 200 OK + Set-Cookie (Final HTML) ───────┤
      │                                                │
      │   (Decode windows-874 -> Check Access Denied)  │
      │   (If valid -> Issue buplaner_session cookie)   │
      ▼                                                ▼
```

### 2.2 Endpoint: `POST /api/auth/login`
Authenticates the student with URSA upstream and creates an active session.

- **URL**: `/api/auth/login`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Request Body**:
  ```json
  {
    "username": "nuchnicha.roon",
    "password": "mySecurePassword123",
    "program": "regular" // "regular" (Thai) or "buic" (International) [Optional, default: "regular"]
  }
  ```
- **Validation Rules**:
  - `username`: Required string, non-empty, trimmed.
  - `password`: Required string, non-empty.
  - `program`: Optional string enum (`'regular'` | `'buic'`).
  - Max payload length: 10,000 bytes.
- **Upstream Request Details**:
  - **URL**: `https://ursa2.bu.ac.th/SetFullId.cfm`
  - **Method**: `POST`
  - **Headers**:
    - `Content-Type`: `application/x-www-form-urlencoded`
    - `Cookie`: Pre-flight cookies obtained from `GET https://ursa2.bu.ac.th/seat/seat1.cfm`
    - `Referer`: `https://ursa2.bu.ac.th/seat/seat1.cfm`
  - **Body**: `liveid=${encodeURIComponent(username)}&inter_passwd=${encodeURIComponent(password)}&option1=${program === 'buic' ? '2' : '1'}`
  - **Redirect Handling**: `redirect: 'manual'`. Follow redirect chain (up to 5 hops) accumulating all cookies from `response.headers.getSetCookie()`.
  - **Response Validation**:
    - Decode final body with `TextDecoder('windows-874')`.
    - Check if cookies are empty or if HTML matches `/Access Denied|User name.*Password/i`.
- **Success Response**:
  - **Status**: `200 OK`
  - **Header**: `Set-Cookie: buplaner_session=<SESSION_TOKEN>; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600; SameSite=Strict${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
  - **Body**:
    ```json
    {
      "ok": true,
      "connected": true
    }
    ```
- **Error Responses**:
  - **400 Bad Request**:
    ```json
    { "error": "username and password are required" }
    ```
  - **401 Unauthorized** (Invalid credentials):
    ```json
    { "error": "URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่" }
    ```
  - **502 Bad Gateway** (Upstream unreachable / timeout / DNS failure):
    ```json
    { "error": "ไม่สามารถเชื่อมต่อ URSA ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" }
    ```

### 2.3 Endpoint: `GET /api/auth/status`
Checks if the current client has a valid, unexpired URSA session.

- **URL**: `/api/auth/status`
- **Method**: `GET`
- **Request Headers**: `Cookie: buplaner_session=<SESSION_TOKEN>`
- **Response**:
  - **Status**: `200 OK`
  - **Body**:
    ```json
    {
      "connected": true
    }
    ```
    or
    ```json
    {
      "connected": false
    }
    ```

### 2.4 Endpoint: `POST /api/auth/logout`
Terminates the active session and clears the session cookie.

- **URL**: `/api/auth/logout`
- **Method**: `POST` (or `GET`)
- **Action**: Removes session token from server-side session store.
- **Header**: `Set-Cookie: buplaner_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Strict`
- **Response**:
  - **Status**: `200 OK`
  - **Body**:
    ```json
    {
      "ok": true,
      "connected": false
    }
    ```

### 2.5 Session Store Architecture
- **Session Model**:
  ```typescript
  interface UrsaSession {
    cookie: string;       // Upstream URSA ColdFusion cookie string
    createdAt: number;    // Epoch ms
  }
  ```
- **TTL**: 3,600,000 ms (1 hour).
- **Session Verification Logic**:
  `const session = sessions.get(id); return session && (Date.now() - session.createdAt < 3600000) ? session : null;`
- **Storage Strategy**: Fast in-memory map (`Map<string, UrsaSession>`) with periodic garbage collection for expired entries, or encrypted stateless cookie tokens.

---

## 3. R2: Student Profile Fetcher Specification

### 3.1 Overview & Endpoint Contract
Fetches and parses the authenticated student's profile information from the URSA Grade Report page.

- **URL**: `/api/profile`
- **Method**: `GET`
- **Headers**:
  - `Cookie: buplaner_session=<SESSION_TOKEN>`
- **Upstream URL**: `https://ursa2.bu.ac.th/remark/remark.cfm`
- **Upstream Method**: `GET`
- **Upstream Headers**:
  - `Cookie: <active_ursa_cookies>`
  - `User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)`
- **Response Decoding**: Must decode raw binary response buffer using `TextDecoder('windows-874')`.

### 3.2 HTML DOM Parsing Rules for `/remark/remark.cfm`
1. Locate Grade Report table: Search for `<table>` containing text matching `/Grade Report/i`, `/Student\s*ID/i`, and `/\bName\b/i`.
2. Extract cells (`td`, `th`).
3. Locate Student Name:
   - Find cell whose trimmed text matches `/^name$/i`.
   - The value is the content of the immediately following cell (`cells[nameIndex + 1]`).
   - Clean up: `.textContent.replace(/\s+/g, ' ').trim()`.
4. Locate Student ID:
   - Find cell whose trimmed text matches `/^student\s*id$/i`.
   - The value is the content of the immediately following cell (`cells[idIndex + 1]`).
   - Clean up: `.textContent.replace(/\s+/g, ' ').trim()`.
5. Extract Faculty / Department (if present in adjacent metadata cells).

### 3.3 Response JSON Schema
- **Status**: `200 OK`
- **Body**:
  ```json
  {
    "ok": true,
    "studentId": "1650701234",
    "studentName": "น.ส. นุชนิชา รุ่งโรจน์",
    "meta": "Student ID 1650701234",
    "html": "<!DOCTYPE html>..." // [Optional / backward compatibility]
  }
  ```

### 3.4 Error & Fallback Behavior
- **401 Unauthorized** (Session missing or expired):
  ```json
  { "error": "Connect URSA first" }
  ```
- **502 Bad Gateway** (Upstream `/remark/remark.cfm` returned HTTP 5xx or timed out):
  ```json
  { "error": "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" }
  ```
- **Profile Parse Failure Fallback**: If upstream responds 200 OK but student table is absent (e.g. fresh term without grades), return `{ ok: true, studentId: "", studentName: "" }` without failing the client planner.

---

## 4. R3: Dynamic Course & Section Query Specification

### 4.1 Endpoint: `GET /api/sections`
Proxies the search form metadata from `https://ursa2.bu.ac.th/seat/seat1.cfm` to populate available Academic Years and Semesters.

- **URL**: `/api/sections`
- **Method**: `GET`
- **Headers**: `Cookie: buplaner_session=<SESSION_TOKEN>`
- **Upstream Request**:
  - `GET https://ursa2.bu.ac.th/seat/seat1.cfm`
  - `Cookie: <active_ursa_cookies>`
- **Decoding**: `windows-874` to UTF-8.
- **Response**:
  - **Status**: `200 OK`
  - **Body**:
    ```json
    {
      "ok": true,
      "html": "<form action=\"seat1.cfm\" method=\"GET\">...",
      "form": {
        "action": "seat1.cfm",
        "method": "GET",
        "controls": [
          {
            "name": "acdyr",
            "type": "select",
            "value": "2569",
            "options": [
              { "value": "2569", "text": "2569" },
              { "value": "2568", "text": "2568" },
              { "value": "2567", "text": "2567" }
            ]
          },
          {
            "name": "sem",
            "type": "select",
            "value": "1",
            "options": [
              { "value": "1", "text": "ภาคเรียนที่ 1" },
              { "value": "2", "text": "ภาคเรียนที่ 2" },
              { "value": "3", "text": "ภาคเรียนฤดูร้อน" }
            ]
          },
          {
            "name": "course_code",
            "type": "text",
            "value": ""
          },
          {
            "name": "option1",
            "type": "select",
            "value": "1",
            "options": [
              { "value": "1", "text": "All Sections" },
              { "value": "2", "text": "Close / Freeze only" }
            ]
          }
        ]
      }
    }
    ```

### 4.2 Endpoint: `POST /api/sections/query`
Proxies section search queries to URSA and parses the HTML table into structured JSON.

- **URL**: `/api/sections/query`
- **Method**: `POST`
- **Content-Type**: `application/json`
- **Headers**: `Cookie: buplaner_session=<SESSION_TOKEN>`
- **Request Body Options**:
  
  **Option A: Raw Form Proxy Format**
  ```json
  {
    "action": "seat1.cfm",
    "method": "GET",
    "fields": {
      "acdyr": "2569",
      "sem": "1",
      "course_code": "CS441",
      "option1": "1"
    }
  }
  ```

  **Option B: Structured Multi-Course Query Format**
  ```json
  {
    "academicYear": "2569",
    "semester": "1",
    "courseCodes": ["CS422", "CS430", "CS441", "CS446", "CS448", "EN103"],
    "option1": "1"
  }
  ```

- **Security & Validation Rules**:
  - Whitelist: Upstream target URL origin must strictly equal `https://ursa2.bu.ac.th` and pathname must start with `/seat/`. Reject any external URL with `400 Bad Request`.
  - Session Check: Reject missing or expired session with `401 Unauthorized`.
  - Upstream Referer: Must include `Referer: https://ursa2.bu.ac.th/seat/seat1.cfm`.

### 4.3 HTML Table Parsing Algorithm for `/seat/seat1.cfm`
1. Locate Results Table: Find `<table>` whose text contains `/Seat\(s\)/i` and `/Status/i` and has more than 3 rows (`tr.length > 3`).
2. Extract Course Code: Match regex `/\b[A-Z]{2,4}\d{3}\b/` from table header / title.
3. Parse Section Rows:
   For each `<tr>` in the table (skipping `<th>` header rows):
   - Cell 0 (`Section`): `sectionNo = cells[0].textContent.trim()` (e.g. `"3271"`).
   - Cell 1 (`Seat(s)`): Parse available vs total seats.
     - Match `/(\d+)\s*\/\s*(\d+)/` -> `availableSeats = parseInt(m[1])`, `totalSeats = parseInt(m[2])`.
     - If only single number: `totalSeats = parseInt(text)`, `availableSeats = 0` if closed/full.
   - Cell 2 (`Status`): `"On"` | `"Close"` | `"Freeze"`.
   - Cell 3 (`Type`): `"LECT"` | `"LAB"` | `"PRAC"`.
   - Cell 4 (`Day`): Map Thai / English day names to `DayOfWeek`:
     - Mon / จันทร์ / M / MO -> `'MON'`
     - Tue / อังคาร / Tu / TU -> `'TUE'`
     - Wed / พุธ / W / WE -> `'WED'`
     - Thu / พฤหัส / Th / TH -> `'THU'`
     - Fri / ศุกร์ / F / FR -> `'FRI'`
     - Sat / เสาร์ / Sa / SA -> `'SAT'`
   - Cell 5 (`Time`): Parse regex `(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})`.
     - `startTime = `${p1.padStart(2, '0')}:${p2}`` (e.g. `"09:00"`).
     - `endTime = `${p3.padStart(2, '0')}:${p4}`` (e.g. `"12:00"`).
   - Cell 6 (`Room`): `room = cells[6].textContent.trim()` (e.g. `"RB4605"`).
   - Cell 7 (`Remark2` / Instructor): `instructor = cells[7].textContent.trim()`.
   - Cell 8 (`Remark1`): `remark1 = cells[8].textContent.trim()`.
   - Cell 9 (`Examination`): `exam = cells[9].textContent.trim()`. Extract `midtermDate` and `finalDate`.
   - Cell 10 (`Restriction`): `restriction = cells[10].textContent.trim()`.

### 4.4 Parsed Response JSON Schema
```json
{
  "ok": true,
  "courses": [
    {
      "id": "cs441",
      "code": "CS441",
      "nameTh": "การวิเคราะห์และออกแบบขั้นตอนวิธี",
      "nameEn": "Algorithms Analysis and Design",
      "credits": 3,
      "category": "IT_COMPUTING",
      "faculty": "คณะเทคโนโลยีสารสนเทศและนวัตกรรม",
      "description": "การวิเคราะห์ความซับซ้อนของอัลกอริทึมขั้นสูง...",
      "color": "#2563EB",
      "sections": [
        {
          "sectionNo": "3271",
          "day": "MON",
          "startTime": "09:00",
          "endTime": "12:00",
          "room": "RB4605",
          "instructor": "ดร. กฤษฎา ภาคภูมิ",
          "campus": "Main Campus (รังสิต)",
          "totalSeats": 40,
          "availableSeats": 12,
          "midtermDate": "14 ต.ค. 2567 (09:00 - 12:00)",
          "finalDate": "2 ธ.ค. 2567 (09:00 - 12:00)"
        }
      ]
    }
  ],
  "html": "<table ...>...</table>"
}
```

---

## 5. R4: Frontend Integration & State Architecture

### 5.1 Authentication Flow & `LoginModal`
- **Initial Load**: Client fires `GET /api/auth/status`. If connected, sets `connected = true` and triggers `GET /api/profile`.
- **Login Modal Form**:
  - Submits `{ username, password, program }` to `POST /api/auth/login`.
  - During submission: Button disabled, shows spinner with text `"กำลังเชื่อมต่อ..."`.
  - On Success: Shows green checkmark `"เข้าสู่ระบบสำเร็จ!"`, sets connection state, closes modal, triggers `/api/profile`, and refreshes active section queries.
  - On Failure: Displays red error banner with URSA error message (`error.message`).

### 5.2 Header Profile Integration
- **Header / Avatar Bar**:
  - Displays `studentName` (e.g. `"น.ส. นุชนิชา รุ่งโรจน์"`) and `studentId` (e.g. `"Student ID 1650701234"`).
  - Status badge: Green dot + `"เชื่อมต่อ URSA แล้ว"` when active; Grey dot + `"ยังไม่ได้เชื่อม URSA"` when disconnected.
  - Connect/Disconnect toggle: Allows fast sign-in or session termination.

### 5.3 CourseExplorer & Search Workflow
- **Academic Year / Term Selectors**: Populated from `/api/sections` form controls or defaulted to current semester.
- **Multi-Course Input**: Supports space-delimited and multi-line strings (e.g. `"CS422 CS430 CS441\nCS446\nCS448\nEN103"`).
- **Loading State**: Component-scoped loading overlay (`bg-black/45 backdrop-blur-[2px]`) with animated spinner and `"Loading..."` text.
- **Search Execution**: Invokes `POST /api/sections/query` for all specified course codes and merges returned sections into state.

### 5.4 TimetableGrid & Interactive Features
- **Ghost Previews**:
  - All unselected sections matching the search query appear as outlined pill cards (`border-2 border-[#0071E3] bg-white`).
  - Hovering a ghost card highlights corresponding entries across `ActiveCoursesList`, `EnrolledCoursesTable`, and `UnselectedCoursesTable`.
  - Clicking a ghost card enrolls the section into the active plan.
- **Solid Enrolled Cards**:
  - Selected courses render with solid Apple Action Blue (`bg-[#0071E3] text-white`).
  - Clicking a solid card or its "X" button removes it from the plan.
- **Time Conflict Engine**:
  - Evaluates all enrolled items in active plan: `startA < endB && startB < endA` on same `day`.
  - Conflicting cards pulse in red (`bg-[#FF3B30] conflict-pulse ring-2 ring-red-400`).
  - `ConflictBanner` renders at top of page describing exact colliding courses and time slots.

### 5.5 Multi-Plan Management & Export
- **Plan Switcher**:
  - Supports 4+ plans (`Plan A`, `Plan B`, `Plan C`, `Plan D`).
  - LocalStorage persistence key: `bu-planer:schedules:v1`.
  - Plan operations: Add Plan (`+`), Delete Plan (Right-click or tab close `X`), Rename Plan (Inline editing on double-click / context menu).
- **CopySecModal**:
  - Formats selected sections into URSA copy text:
    ```
    + Plan A
    CS441 Algorithms Analysis and Design : 3271 : 09:00-12:00
    CS446 Cloud Architecture and DevOps : 4461 : 09:00-12:00
    ```
  - Triggers confetti celebration (`canvas-confetti`) on copy.

---

## 6. Complete Feature Inventory Table

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Auth (R1) | Upstream Landing Handshake | Fetch `/seat/seat1.cfm` to negotiate initial ColdFusion cookies | None | Cookie header string | Throws 502 if URSA unreachable | `ScheduleBU/server.js:18` |
| 2 | Auth (R1) | URSA SetFullId Proxy | POST credentials to `/SetFullId.cfm` with referer and cookie | `liveid`, `inter_passwd`, `option1` | Upstream redirect response | Throws 401 if credentials rejected | `ScheduleBU/server.js:20` |
| 3 | Auth (R1) | Multi-hop Redirect Tracker | Follows up to 5 HTTP 30x redirects while accumulating cookies | Redirect `Location` headers | Final response + Cookie jar | Terminates at 5 hops or non-3xx | `ScheduleBU/server.js:22` |
| 4 | Auth (R1) | Windows-874 Text Decoding | Decodes binary response buffer into UTF-8 Thai text | `ArrayBuffer` | Decoded HTML string | Replaces invalid byte sequences | `ScheduleBU/server.js:14` |
| 5 | Auth (R1) | Credential Rejection Detector | Regex test `/Access Denied\|User name.*Password/i` | Decoded HTML | Boolean pass/fail | Returns HTTP 401 with Thai message | `ScheduleBU/server.js:28` |
| 6 | Auth (R1) | Session Token Generation | Generates cryptographically secure base64url session ID | 32 random bytes | 43-char token string | N/A | `ScheduleBU/server.js:39` |
| 7 | Auth (R1) | HTTP-Only Session Cookie | Sets `buplaner_session` cookie with Strict SameSite and 1h Max-Age | Session Token | `Set-Cookie` header | N/A | `ScheduleBU/server.js:40` |
| 8 | Auth (R1) | Auth Status Verifier | Checks existence and TTL (< 1 hour) of active session | Session cookie | `{ connected: boolean }` | Returns `connected: false` if expired | `ScheduleBU/server.js:42` |
| 9 | Auth (R1) | Session Logout & Invalidation | Clears session from memory and sets Max-Age=0 cookie | Session cookie | `{ ok: true, connected: false }` | N/A | Specification Architecture |
| 10 | Profile (R2) | Profile Page Fetcher | Proxies GET request to `/remark/remark.cfm` with URSA cookie | Active URSA cookie | Windows-874 HTML buffer | Returns 401 if unauthenticated, 502 on upstream error | `ScheduleBU/server.js:53` |
| 11 | Profile (R2) | Grade Report Table Extractor | Locates table with `/Grade Report/i`, `/Student ID/i`, `/Name/i` | HTML string | Table Element / Token | Returns empty fallback if table missing | `ScheduleBU/app.js:59` |
| 12 | Profile (R2) | Student Name & ID Parsing | Extracts name and studentId from adjacent cells | DOM cells | `{ studentId, studentName }` | Trims and cleans whitespace | `ScheduleBU/app.js:59` |
| 13 | Profile (R2) | Header Profile Display | Displays student name and ID in application header/sidebar | Profile state | Visual DOM elements | Shows `"ยังไม่ได้เชื่อม URSA"` when disconnected | `ScheduleBU/index.html:43` |
| 14 | Profile (R2) | Non-blocking Profile Fallback | Profile errors do not prevent timetable planning | Fetch error / 401 | Graceful silent catch | Timetable continues to operate | `ScheduleBU/app.js:59` |
| 15 | Sections (R3) | Form Metadata Retrieval | Proxies GET `/seat/seat1.cfm` to discover term/year form controls | Active URSA cookie | Form controls schema JSON | Returns 401 if unauthenticated | `ScheduleBU/server.js:43` |
| 16 | Sections (R3) | Section Query Proxy | Proxies GET/POST queries to `/seat/seat1.cfm` with search fields | `acdyr`, `sem`, `course_code`, `option1` | Decoded section HTML | Returns 401 if unauthenticated, 502 if upstream fails | `ScheduleBU/server.js:44` |
| 17 | Sections (R3) | Upstream URL Whitelist Validation | Validates action origin matches `https://ursa2.bu.ac.th/seat/` | Action URL | Validated URL / Error | Returns 400 Bad Request if URL is external | `ScheduleBU/server.js:47` |
| 18 | Sections (R3) | Section Table DOM Filter | Finds table containing `/Seat\(s\)/i` and `/Status/i` | HTML string | Matching Table Element | Returns empty array if no table found | `ScheduleBU/app.js:51` |
| 19 | Sections (R3) | Course Code Pattern Extractor | Extracts course code using regex `/\b[A-Z]{2,4}\d{3}\b/` | Table Text | Course code string | Fallbacks to `"รายวิชา"` if code missing | `ScheduleBU/app.js:53` |
| 20 | Sections (R3) | Seat Availability Parser | Extracts available seats and total seats (e.g. `12 / 40`, `0 / 35`) | Cell 1 text | `availableSeats`, `totalSeats` | Badges `เต็ม` if available is 0 | `UrsaSectionTable.tsx:98` |
| 21 | Sections (R3) | Day of Week Normalizer | Maps Thai/English day names to standard `DayOfWeek` | Cell 4 text | `'MON' \| ... \| 'SAT'` | Ignores invalid day slots | `scheduleUtils.ts:4` |
| 22 | Sections (R3) | Time Range Parser | Parses start/end times (`HH:MM - HH:MM` or `HH.MM`) | Cell 5 text | `startTime`, `endTime` | Validates regex format | `scheduleUtils.ts:27` |
| 23 | Sections (R3) | Room & Type Classifier | Extracts room and classifies as `LAB` if room contains `"lab"` | Cell 6 text | `room`, `type` (`LECT`/`LAB`) | Default: `LECT` | `UrsaSectionTable.tsx:69` |
| 24 | Sections (R3) | Exam & Restrictions Extractor | Extracts midterm/final exam schedules and enrollment restrictions | Cells 7-10 text | `midtermDate`, `finalDate`, `restriction` | Displays `"-"` if empty | `UrsaSectionTable.tsx:113` |
| 25 | UI/UX (R4) | Apple-style Login Modal | Modal dialog with inputs for URSA username and password | User input | Dispatches login API call | Renders inline Thai error on rejection | `LoginModal.tsx:61` |
| 26 | UI/UX (R4) | Live Connection Indicator | Header status indicator showing real-time URSA session status | Connection state | Green/Grey indicator pill | Interactive click to connect/disconnect | `Header.tsx` / `page.tsx:212` |
| 27 | UI/UX (R4) | Multi-line Course Input | Textarea accepting space, comma, or newline-separated course codes | Textarea input | Tokenized search query | Trims whitespace and splits tokens | `CourseExplorer.tsx:115` |
| 28 | UI/UX (R4) | Component-scoped Loading Overlay | Full overlay with spinner covering explorer during search | `isLoading` state | Glassmorphism loading banner | Auto-dismisses on completion | `CourseExplorer.tsx:50` |
| 29 | UI/UX (R4) | Ghost Preview Section Cards | Outlined cards showing all available sections on timetable grid | Unselected sections | Outlined interactive cards | Hover syncs with tables | `TimetableGrid.tsx:472` |
| 30 | UI/UX (R4) | Solid Enrolled Section Cards | Solid Apple Action Blue cards for enrolled courses | Enrolled items | Solid interactive cards | Clicking "X" removes section | `TimetableGrid.tsx:524` |
| 31 | UI/UX (R4) | Time Conflict Detection | Detects overlapping time intervals on the same day | Enrolled items | `TimeConflict[]` list | Triggers red pulse + banner | `scheduleUtils.ts:32` |
| 32 | UI/UX (R4) | Conflict Alert Banner | Banner warning user of overlapping schedules with course details | `TimeConflict[]` | Red warning banner | Hidden when conflicts count is 0 | `ConflictBanner.tsx:11` |
| 33 | UI/UX (R4) | Enrolled Courses Table | Table displaying exact URSA metadata for selected courses | Enrolled items | URSA-formatted table | Shows empty placeholder if none selected | `EnrolledCoursesTable.tsx:11` |
| 34 | UI/UX (R4) | Unselected Courses Table | Table displaying exact URSA metadata for unselected courses | Unselected items | URSA-formatted table | Shows `"เลือกครบทุกวิชาแล้ว"` when empty | `UnselectedCoursesTable.tsx:11` |
| 35 | UI/UX (R4) | Multi-Plan Management | Tabs for Plan A, Plan B, Plan C, Plan D with LocalStorage | Plan switcher | Dynamic tab bar | Prompts before deleting plan | `TimetableGrid.tsx:288` |
| 36 | UI/UX (R4) | Copy Code & Sec Modal | Exports plan into formatted text for URSA registration system | Enrolled items | Formatted text + Confetti | Copies to system clipboard | `CopySecModal.tsx:16` |

---

## 7. Edge Cases & Boundary Conditions

| # | Feature | Input / Condition | Observed / Required Behavior |
|---|---------|-------------------|-----------------------------|
| 1 | Auth Login | Empty username or password | API returns HTTP 400 Bad Request with `{ "error": "username and password are required" }`. |
| 2 | Auth Login | Invalid credentials (wrong password) | Upstream returns "Access Denied" or login form. API returns HTTP 401 with `{ "error": "URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่" }`. |
| 3 | Auth Login | URSA server offline / DNS resolution failure | Fetch throws network error. API returns HTTP 502 with `{ "error": "ไม่สามารถเชื่อมต่อ URSA ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" }`. |
| 4 | Auth Login | Circular or runaway 302 redirects (>5 hops) | Redirect loop breaker caps loop at 5 iterations, preventing infinite server hanging. |
| 5 | Auth Session | Expired session token (> 1 hour old) | `GET /api/auth/status` returns `{ "connected": false }`. Subsequent protected calls return HTTP 401 `{ "error": "Connect URSA first" }`. |
| 6 | Profile Fetch | Student has no Grade Report on `/remark/remark.cfm` | DOM parser gracefully finds 0 matching tables. API returns `{ "ok": true, "studentId": "", "studentName": "" }` without breaking UI. |
| 7 | Profile Fetch | Thai character encoding in Student Name | Raw binary bytes decoded via `windows-874`. Accents, vowels, and tone marks render without mojibake (e.g. `"นุชนิชา"` instead of `"¹Øª¹ÔªÒ"`). |
| 8 | Section Query | Unauthenticated request to `/api/sections/query` | API rejects with HTTP 401 `{ "error": "Connect URSA first" }`. UI prompts `LoginModal`. |
| 9 | Section Query | SSRF attempt (action = `https://evil.com/leak`) | Target URL origin check fails (`target.origin !== 'https://ursa2.bu.ac.th'`). Rejects with HTTP 400 `{ "error": "Invalid URSA form target" }`. |
| 10 | Section Query | Course code has no matching sections | Upstream returns table with 0 rows or "No data found". Parser returns empty array `{ "ok": true, "courses": [] }`. UI shows empty state. |
| 11 | Section Parse | Section has 0 available seats (`0 / 40`) | `availableSeats = 0`. UI renders red badge `"เต็ม (0/40)"` and disables auto-selection conflict alerts. |
| 12 | Section Parse | Non-standard time format (e.g. `09.00 - 12.00` or `13:30-16:30`) | Regex `(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})` normalizes times to standard `09:00` and `12:00`. |
| 13 | Timetable Grid | Multiple sections overlapping in same time slot | Clustering algorithm calculates column splits (`width: 50%`, `left: 0%` and `left: 50%`), rendering side-by-side without visual clipping. |
| 14 | Timetable Grid | User switches active plan (e.g. Plan A to Plan B) | Calendar grid instantly swaps displayed cards and recalculates credit count and conflicts without full page reload. |

---

## 8. End-to-End (E2E) Verification Matrix

| Test ID | Feature Group | Test Scenario | Steps | Expected Result | Verification Method |
|---------|---------------|---------------|-------|-----------------|---------------------|
| TC-01 | R1: Auth | Successful Login Handshake | 1. Open LoginModal.<br>2. Enter valid URSA credentials.<br>3. Submit form. | 1. POST `/api/auth/login` returns 200 OK.<br>2. `buplaner_session` cookie is set.<br>3. Status changes to "เชื่อมต่อแล้ว". | `curl -X POST /api/auth/login -H "Content-Type: application/json" -d '{"username":"...","password":"..."}'` + inspect Set-Cookie |
| TC-02 | R1: Auth | Invalid Credentials Rejection | 1. Open LoginModal.<br>2. Enter invalid password.<br>3. Submit form. | 1. POST `/api/auth/login` returns 401 Unauthorized.<br>2. Thai error message is displayed in modal. | Automated unit/integration test checking HTTP 401 and error string |
| TC-03 | R1: Auth | Session Status Polling | 1. Call GET `/api/auth/status` without cookie.<br>2. Call with valid cookie. | 1. Returns `{ "connected": false }`.<br>2. Returns `{ "connected": true }`. | `curl -i http://localhost:3000/api/auth/status` |
| TC-04 | R1: Auth | Session Logout | 1. Call POST `/api/auth/logout` with active cookie. | 1. Returns `{ "ok": true, "connected": false }`.<br>2. Clears `buplaner_session` cookie (Max-Age=0). | `curl -i -X POST http://localhost:3000/api/auth/logout` |
| TC-05 | R2: Profile | Student Profile Extraction | 1. Authenticate session.<br>2. Call GET `/api/profile`. | 1. Returns 200 OK with `studentId` and `studentName`.<br>2. Thai text is cleanly decoded without mojibake. | `curl -b "buplaner_session=..." http://localhost:3000/api/profile` |
| TC-06 | R2: Profile | Unauthenticated Profile Rejection | 1. Call GET `/api/profile` with no session. | 1. Returns 401 Unauthorized `{ "error": "Connect URSA first" }`. | `curl -i http://localhost:3000/api/profile` |
| TC-07 | R3: Sections | Form Metadata Discovery | 1. Call GET `/api/sections` with active session. | 1. Returns 200 OK with form action and term/year select options. | `curl -b "buplaner_session=..." http://localhost:3000/api/sections` |
| TC-08 | R3: Sections | Section Query & Table Parsing | 1. POST `/api/sections/query` with `course_code: "CS441"`, `acdyr: "2569"`, `sem: "1"`. | 1. Returns 200 OK with structured `Course` object containing sections, seats, time, day, room, and instructors. | `curl -X POST /api/sections/query -H "Content-Type: application/json" -b "..." -d '{"fields":{"course_code":"CS441"}}'` |
| TC-09 | R3: Sections | SSRF Protection Check | 1. POST `/api/sections/query` with `action: "https://attacker.com/steal"`. | 1. Rejects with 400 Bad Request `{ "error": "Invalid URSA form target" }`. | Automated security unit test |
| TC-10 | R4: Frontend | Live Ghost Preview & Enrollment | 1. Search for `"CS441 CS446"`.<br>2. Verify ghost preview cards render.<br>3. Click a ghost card. | 1. Ghost card converts into solid blue enrolled card.<br>2. Section moves from Unselected Table to Enrolled Table. | Playwright / React Testing Library E2E test |
| TC-11 | R4: Frontend | Time Conflict Alert Banner | 1. Select two sections with overlapping day & time (e.g. Mon 09:00-12:00). | 1. ConflictBanner appears with red warning.<br>2. Overlapping cards pulse red on timetable grid. | Playwright / UI state test |
| TC-12 | R4: Frontend | Multi-Plan Switching & LocalStorage | 1. Enroll courses in Plan A.<br>2. Switch to Plan B.<br>3. Add different courses to Plan B.<br>4. Switch back to Plan A. | 1. Plan A retains its original courses.<br>2. Data persists in LocalStorage key `bu-planer:schedules:v1`. | Playwright / LocalStorage verification |
| TC-13 | Build | Production Next.js Build | 1. Run `npm run build`. | 1. TypeScript compiles with 0 errors.<br>2. All API routes and client pages generate cleanly. | `npm run build` command exit code 0 |

---
