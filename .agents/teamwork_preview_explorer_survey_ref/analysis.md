# Comprehensive Reference Implementation Analysis: ScheduleBU (BU Planer)

**Target Repository**: `C:\Users\Nisha\Downloads\ScheduleBU`  
**Analyzer**: Explorer 1 (Reference Implementation Investigator)  
**Date**: 2026-08-21  

---

## Executive Summary

`ScheduleBU` is a lightweight, standalone Node.js and vanilla JavaScript web application designed to proxy and parse Bangkok University's URSA (University Registration and Student Affairs) ColdFusion web system (`https://ursa2.bu.ac.th`).

Key technical characteristics:
1. **Upstream Architecture**: ColdFusion (`.cfm`) backend running on `https://ursa2.bu.ac.th`.
2. **Encoding**: Thai Windows-874 (`windows-874` / CP874). Upstream returns raw binary buffers that must be decoded using `new TextDecoder('windows-874').decode(buffer)`.
3. **Session Management**: Cookie-based authentication via `/SetFullId.cfm` requiring multi-step redirect tracking (up to 5 hops of HTTP 302) and cookie aggregation (`CFID`, `CFTOKEN`, `JSESSIONID`).
4. **Session Proxy Pattern**: Server-side in-memory session store mapping opaque `base64url` tokens stored in `buplaner_session` HTTP-only cookie with 1-hour expiration.
5. **Endpoints Proxied**:
   - `https://ursa2.bu.ac.th/SetFullId.cfm` (Authentication)
   - `https://ursa2.bu.ac.th/remark/remark.cfm` (Student Profile & Grade Report)
   - `https://ursa2.bu.ac.th/seat/seat1.cfm` (Course & Section Seat Query)

---

## 1. URSA Authentication Flow (`/SetFullId.cfm`)

### 1.1 Form Fields & Parameters
- **Target URL**: `https://ursa2.bu.ac.th/SetFullId.cfm`
- **Method**: `POST`
- **Content-Type**: `application/x-www-form-urlencoded`
- **Parameters**:
  | Field Name | Type | Description / Accepted Values |
  | :--- | :--- | :--- |
  | `liveid` | string | Student / User login account (e.g. `nuchnicha.roon` or Student ID) |
  | `inter_passwd` | string | Student URSA password |
  | `option1` | string | Program selector: `'1'` for Regular Program, `'2'` for BUIC (Bangkok University International College) |

### 1.2 Multi-Step Handshake & Redirect Flow
URSA requires an initial cookie seed followed by manual redirect following to capture all authentication cookies:

1. **Seed Step (Landing GET)**:
   - Request: `GET https://ursa2.bu.ac.th/seat/seat1.cfm` with `{ redirect: 'manual' }`.
   - Extract initial `Set-Cookie` headers via `response.headers.getSetCookie()` (or equivalent headers array).
   - Format into cookie string: `key=value; key2=value2`.

2. **Login Submission Step (POST)**:
   - Request: `POST https://ursa2.bu.ac.th/SetFullId.cfm`
   - Headers:
     - `content-type: application/x-www-form-urlencoded`
     - `cookie: <merged_cookie_string>`
     - `referer: https://ursa2.bu.ac.th/seat/seat1.cfm`
   - Body: `URLSearchParams({ liveid, inter_passwd, option1 })`
   - Option: `{ redirect: 'manual' }`
   - Collect and merge any new `Set-Cookie` headers into the cookie accumulator.

3. **Redirect Traversal Loop**:
   - URSA issues 302 Found / 301 Moved redirects through ColdFusion session initializers.
   - Loop condition: `for (let i = 0; i < 5 && response.status >= 300 && response.status < 400; i++)`
   - Extract `location` header (`response.headers.get('location')`).
   - If no location header, break loop.
   - Fetch target: `new URL(location, 'https://ursa2.bu.ac.th')` with `{ redirect: 'manual', headers: { cookie } }`.
   - Merge `Set-Cookie` headers at every hop:
     `cookie = [cookie, upstreamCookie(response)].filter(Boolean).join('; ')`

4. **Credential Verification & Failure Detection**:
   - Read final response binary and decode via Windows-874:
     `const html = await ursaText(response)`
   - Validation checks:
     - Check 1: Cookie must not be empty.
     - Check 2: HTML body must NOT match `/Access Denied|User name.*Password/i`.
   - If invalid: throw error `'URSA rejected the credentials'` (which maps to HTTP 401: *"URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่"*).

### 1.3 Cookie Persistence & Session Management
- Server generates a cryptographically secure random token:
  `const id = crypto.randomBytes(32).toString('base64url');`
- Stored in-memory in server `sessions` Map:
  `sessions.set(id, { cookie: aggregatedUpstreamCookie, createdAt: Date.now() });`
- Client response sets HTTP-only cookie:
  `Set-Cookie: buplaner_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`
- Session lookup & TTL:
  - Expiry is 3,600,000 ms (1 hour).
  - Validation: `Date.now() - session.createdAt < 3600000`.

---

## 2. Student Profile Fetching & Parsing (`/remark/remark.cfm`)

### 2.1 Proxy Endpoint & Upstream Request
- **Endpoint**: `GET /api/profile`
- **Upstream Target**: `https://ursa2.bu.ac.th/remark/remark.cfm`
- **Headers**: `{ cookie: activeSession.cookie }`
- **Response Handling**: Buffer converted from `windows-874` to UTF-8.
- **Error Handling**: Non-blocking. If profile fetch fails, frontend logs/catches silently so timetable planning continues uninterrupted.

### 2.2 HTML Table Structure & Extraction Logic
In URSA, `/remark/remark.cfm` renders a student information and grade report table.

```javascript
const documentFromUrsa = new DOMParser().parseFromString(html, 'text/html');
const report = [...documentFromUrsa.querySelectorAll('table')].find((table) => 
  /Grade Report/i.test(table.textContent) && 
  /Student\s*ID/i.test(table.textContent) && 
  /\bName\b/i.test(table.textContent)
);
```

Extraction:
1. Locate all `td, th` cells within the identified report table:
   `const cells = [...report.querySelectorAll('td, th')];`
2. Find index of cell with text matching `/^name$/i`:
   `const nameIndex = cells.findIndex(cell => /^name$/i.test(cell.textContent.trim()));`
3. Find index of cell with text matching `/^student\s*id$/i`:
   `const idIndex = cells.findIndex(cell => /^student\s*id$/i.test(cell.textContent.trim()));`
4. The corresponding values reside in the immediately following cell `index + 1`:
   - `studentName = cells[nameIndex + 1]?.textContent.replace(/\s+/g, ' ').trim()`
   - `studentId = cells[idIndex + 1]?.textContent.replace(/\s+/g, ' ').trim()`

---

## 3. Course and Section Query Flow (`/seat/seat1.cfm`)

### 3.1 Form Metadata & Discovery (`GET /api/sections`)
- **Upstream Target**: `GET https://ursa2.bu.ac.th/seat/seat1.cfm`
- Dynamic inspection of URSA's search form via `readUrsaForm(html)`:
  - Scans `document.forms` for the form containing fields matching `/year|term|course|section|acd|sem/i`.
  - Extracts form `action` (defaults to `seat1.cfm`) and `method` (defaults to `GET`).
  - Extracts input controls (`select`, `text`, `hidden`), ignoring `submit`, `button`, `password`, `radio`.
  - For `<select>` controls, parses options `{ value, text }` and current default `value`.
  - Field label localization mappings:
    - `year`, `academic_year`, `acdyr` → `'ปีการศึกษา'`
    - `term`, `semester`, `semcode` → `'ภาคเรียน'`
    - `course`, `coursecode`, `course_code`, `subject` → `'รหัสวิชา'`
    - `section` → `'Section'`

### 3.2 Query Execution (`POST /api/sections/query`)
- **Client Payload**: `{ action, method, fields }`
- **Target URL Construction & Validation**:
  - `const target = new URL(action || 'seat1.cfm', 'https://ursa2.bu.ac.th/seat/seat1.cfm');`
  - Strict security validation: `target.origin === URSA && target.pathname.startsWith('/seat/')`.
- **Method Handling**:
  - If `GET`: Append fields as query parameters: `target.searchParams.set(key, value)`.
  - If `POST`: Send `application/x-www-form-urlencoded` body `new URLSearchParams(fields)`.
- **Headers**:
  - `cookie: activeSession.cookie`
  - `referer: https://ursa2.bu.ac.th/seat/seat1.cfm`
- **Output**: Returns UTF-8 converted HTML string.

### 3.3 HTML Results Table Structure & Column Mapping
In `renderResults(html)`:
1. Locates results table:
   `table.textContent.includes('Seat(s)') && table.textContent.includes('Status') && table.querySelectorAll('tr').length > 3`
2. Course code extraction:
   `const course = sourceTable.textContent.match(/\b[A-Z]{2,4}\d{3}\b/)?.[0] || 'รายวิชา';`
3. Table column indexes (for rows with `cells.length >= 9` and no `th`):
   | Column Index | Field Name | Example Value | Description |
   | :--- | :--- | :--- | :--- |
   | `cells[0]` | Section | `3271`, `4461` | Section identifier |
   | `cells[1]` | Seat(s) / Availability | `12 / 40`, `0 / 35` | Available seats vs Total capacity |
   | `cells[2]` | Status | `On`, `Close`, `Freeze` | Registration status |
   | `cells[3]` | Degree / Level | `Bachelor` | Education level |
   | `cells[4]` | Remark / Class | `Regular` | Program distinction |
   | `cells[5]` | Type | `LECT`, `LAB`, `LEC/LAB` | Instruction delivery type |
   | `cells[6]` | Day | `Mon`, `Tue`, `Wed`, `Thu`, `Fri`, `Sat` | Class meeting day |
   | `cells[7]` | Time | `09:00 - 12:00`, `09.00-12.00`, `13:30 - 16:30` | Start and end time range |
   | `cells[8]` | Room | `RB4605`, `Diamond Lab 4`, `C2-304` | Building and room code |
   | `cells[9]` | Remark 2 | `-` | Special note |
   | `cells[10]` | Remark 1 | `-` | Section note |
   | `cells[11]` | Examination | `14 ต.ค. 2567 (09:00 - 12:00)` | Midterm/Final exam date & slot |
   | `cells[12]` | Restriction | `- R All All TP Both` | Major / Faculty restrictions |

---

## 4. Time & Day Parsing Specifications

### 4.1 Time Regex Matching
ScheduleBU matches times using:
```javascript
const time = data.time.match(/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/);
if (time) {
  const startMinutes = Number(time[1]) * 60 + Number(time[2]);
  const endMinutes = Number(time[3]) * 60 + Number(time[4]);
}
```
- Accommodates both `:` and `.` delimiters (e.g. `09:00` vs `09.00`).
- Accommodates 1 or 2 digit hours (`9:00` or `09:00`).

### 4.2 Day Mapping
```javascript
const dayMap = {
  mon: 'MON',
  tue: 'TUE',
  wed: 'WED',
  thu: 'THU',
  fri: 'FRI',
  sat: 'SAT'
};
```
Day string is normalized by taking `.toLowerCase().slice(0, 3)` (e.g. `'Monday'` → `'mon'` → `'MON'`).

---

## 5. Critical Edge Cases & Engineering Considerations for Next.js

1. **Windows-874 / CP874 Character Encoding**:
   - `fetch()` in Node.js / Next.js defaults to UTF-8 when calling `response.text()`.
   - Calling `response.text()` directly on URSA responses corrupts Thai text into mojibake (`???` or unreadable Latin characters).
   - **Solution**: Always fetch as `response.arrayBuffer()` and decode using `new TextDecoder('windows-874').decode(buffer)`.

2. **Upstream Cookies Across Multi-Hop Redirects**:
   - URSA sets `CFID`, `CFTOKEN`, and `JSESSIONID` across multiple HTTP 302 responses.
   - Next.js Route Handlers using standard `fetch()` with `redirect: 'follow'` may lose intermediate `Set-Cookie` headers.
   - **Solution**: Implement `redirect: 'manual'` redirect chain loop with cookie accumulator using `response.headers.getSetCookie()`.

3. **Session State Storage in Next.js**:
   - Next.js runs in serverless / multi-instance or dev mode with fast refresh.
   - In-memory `Map` on global scope or encrypted cookie session can be used for `buplaner_session`.
   - Store the upstream URSA cookie string securely associated with the user's session token.

4. **Empty / Multiple / Batch Queries**:
   - When searching multiple course codes (e.g. `"CS422 CS430 CS441"`), URSA's `/seat/seat1.cfm` form handles individual course code queries per request.
   - The Next.js API layer or client can orchestrate batch queries across multiple course codes in parallel or sequential batching to aggregate sections into the unified planner view.

5. **Seats Parsing & Status**:
   - Available seats string format: `"12 / 40"` or `"0 / 35"` or `"เต็ม"`.
   - Total seats: second number in `"available / total"` string.
   - Available seats: first number; if 0, marks section as full (`เต็ม`).

---

## 6. Architecture Comparison: ScheduleBU vs Quick-Chandrasekhar

| Dimension | ScheduleBU (Reference) | Quick-Chandrasekhar (Target) |
| :--- | :--- | :--- |
| **Framework** | Plain Node.js `http` + Vanilla JS | Next.js 15 (App Router, Turbopack, TS, Tailwind) |
| **UI Design System** | Basic CSS custom properties | Apple UI Design (`apple-card-light`, SF Pro / Noto Sans Thai, Concentric Rings) |
| **API Endpoints** | Node `http` listener (`server.js`) | Next.js Route Handlers (`src/app/api/auth/*`, `src/app/api/profile/*`, `src/app/api/sections/*`) |
| **Data Flow** | Direct DOM injection | React State, Context/Hooks, `useMemo` time conflict detector |
| **Tables** | Single HTML string dump | Split `EnrolledCoursesTable` & `UnselectedCoursesTable` + Live Section data |

---

## 7. Recommended Implementation Blueprint for Next.js

1. **Route Handlers to Create**:
   - `src/app/api/auth/login/route.ts` (POST) — Handles `liveid`, `inter_passwd`, `option1`, negotiates URSA multi-hop redirect cookies, sets `buplaner_session`.
   - `src/app/api/auth/status/route.ts` (GET) — Returns `{ connected: boolean }`.
   - `src/app/api/auth/logout/route.ts` (POST) — Clears session.
   - `src/app/api/profile/route.ts` (GET) — Fetches `/remark/remark.cfm`, decodes Windows-874, parses/returns `{ studentId, nameTh, nameEn, ok: true }`.
   - `src/app/api/sections/route.ts` (GET) — Fetches `/seat/seat1.cfm` metadata/form options.
   - `src/app/api/sections/query/route.ts` (POST) — Submits course query to URSA, decodes Windows-874, parses HTML table into structured `Course[]` and `Section[]` JSON objects.

2. **Parsing Utility Module**:
   - `src/utils/ursaParser.ts` — Server-side Windows-874 decoder, profile extractor, and section table parser converting raw URSA HTML into strict TypeScript `Course` and `Section` models.
