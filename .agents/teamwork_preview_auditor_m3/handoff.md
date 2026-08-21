# Forensic Audit Report: Milestone 3 — Dynamic Course & Section Query

**Work Product**: `src/lib/ursa/sectionParser.ts`, `src/app/api/sections/route.ts`, `src/app/api/sections/query/route.ts`, `src/types/ursa.ts`, `src/types/schedule.ts`  
**Profile**: General Project  
**Integrity Mode**: Development / Demo Mode (URSA Integration from Reference Architecture)  
**Verdict**: `VERDICT: CLEAN`

---

## 1. Observation

A comprehensive forensic audit was conducted on all Milestone 3 (Dynamic Course & Section Query) source files and API endpoints across static analysis, behavioral verification, anti-tamper, and security dimensions.

### 1.1 Target Source Analysis

#### 1. `src/lib/ursa/sectionParser.ts` (377 lines)
- **Entity & Tag Cleaning (`cleanHtmlText`)** (Lines 15–29):
  - Strips HTML tags via `/<[^>]+>/g`.
  - Decodes named HTML entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`).
  - Decodes hexadecimal entities `&#x([0-9a-fA-F]+);` and decimal numeric entities `&#(\d+);`.
  - Normalizes multiple whitespace characters `/\s+/g` into single spaces and trims.
- **Day of Week Normalization (`normalizeDayOfWeek`)** (Lines 34–54):
  - Normalizes Thai day variations (`จันทร์`, `วันจันทร์`, `อังคาร`, `วันอังคาร`, `พุธ`, `วันพุธ`, `พฤหัส`, `พฤหัสบดี`, `วันพฤหัสบดี`, `ศุกร์`, `วันศุกร์`, `เสาร์`, `วันเสาร์`).
  - Normalizes English day names and two-letter abbreviations (`Mon`, `Monday`, `MO`, `Tue`, `Tuesday`, `TU`, etc.).
  - Returns strictly typed `DayOfWeek` (`'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'`) or `null`.
- **Time Range Parser (`parseTimeRange`)** (Lines 59–74):
  - Regular expression: `/(\d{1,2})[.:](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[.:](\d{2})/i`.
  - Handles colon and dot separators (`09:00 - 12:00`, `09.00 - 12.00`), en-dashes, and em-dashes.
  - Zero-pads single-digit start/end hours (e.g., `9:00` -> `09:00`).
- **Seat Count Parser (`parseSeatCount`)** (Lines 79–103):
  - Parses ratio expressions `/(\d+)\s*\/\s*(\d+)/` into `{ availableSeats, totalSeats }`.
  - Parses single integers `\b\d+\b`.
  - Handles closed/freeze statuses (`/เต็ม|close|full/i` or `isClosed === true`), setting `availableSeats: 0`.
- **Exam Dates Parser (`parseExamDates`)** (Lines 108–132):
  - Parses midterm and final examination schedules from raw table text separated by `/` or newline.
  - Returns `{ midtermDate, finalDate }`.
- **URSA Form Parser (`parseUrsaForm`)** (Lines 161–246):
  - Discovers `<form>` containers in URSA `/seat/seat1.cfm` HTML.
  - Extracts `action` and `method` attributes.
  - Scans `<select>` elements and `<option>` children, extracting option values and text while tracking `selected` states.
  - Scans `<input>` elements, filtering out non-data controls (`submit`, `button`, `password`, `radio`).
  - Validates form control relevance against URSA parameter names (`year|term|course|section|acd|sem|option`).
- **Section Table HTML Parser (`parseSectionsHtml`)** (Lines 251–376):
  - Sanitizes HTML by stripping `<script>`, `<style>`, and `<!-- comments -->`.
  - Identifies target tables matching `/Seat\(s\)|ที่นั่ง/i` and `/Status|สถานะ|Section|ตอนเรียน|กลุ่ม/i` (with fallback heuristic for tables with >=3 rows and 4-digit numbers).
  - Extracts course codes via regex `/\b([A-Z]{2,4}\s*\d{3})\b/i` or fallback parameter.
  - Uses `MOCK_COURSES` strictly for catalog metadata enrichment (course names, credits, faculty); for unknown/novel courses, generates dynamic fallback course metadata and deterministic hex palette colors (`getCourseColor`).
  - Parses all section rows (`sectionNo`, `availableSeats`, `totalSeats`, `day`, `startTime`, `endTime`, `room`, `instructor`, `campus`, `midtermDate`, `finalDate`).
  - Maps campus based on room name (`/City|กล้วยน้ำไท/i` -> `'City Campus (กล้วยน้ำไท)'`, else `'Main Campus (รังสิต)'`).
  - Deduplicates sections by `sectionNo` and returns structured `Course[]`.

#### 2. `src/app/api/sections/route.ts` (71 lines)
- **Session Authentication** (Lines 9–22):
  - Validates presence of `buplaner_session` cookie.
  - Validates TTL via `getSession(sessionId)`. Returns 401 `{ error: 'Connect URSA first' }` with `Cache-Control: no-store, max-age=0` if invalid or expired.
- **Upstream Form Fetching & Decoding** (Lines 24–40):
  - Calls `fetchUrsa('/seat/seat1.cfm', session.cookie)`.
  - Handles upstream 5xx errors by returning 502 Bad Gateway with Thai error message.
  - Decodes binary response buffer via `decodeUrsaResponse` (windows-874 to UTF-8).
  - Parses form metadata via `parseUrsaForm`.
- **Response** (Lines 41–57):
  - Returns HTTP 200 `{ ok: true, html, form }` with `Cache-Control: no-store, max-age=0`.

#### 3. `src/app/api/sections/query/route.ts` (196 lines)
- **Session Authentication** (Lines 11–24):
  - Validates active URSA session token from cookies. Returns 401 `{ error: 'Connect URSA first' }` on failure.
- **SSRF & Whitelist URL Guard** (Lines 44–69):
  - Constructs `targetUrl = new URL(action || 'seat1.cfm', `${URSA_BASE_URL}/seat/seat1.cfm`)`.
  - Validates host with `isAllowedUrsaHost(targetUrl.hostname)` (must be `ursa2.bu.ac.th` or `.bu.ac.th`).
  - Enforces `targetUrl.pathname.startsWith('/seat/')`, preventing SSRF requests to administrative or unintended URSA paths. Returns 400 `{ error: 'Invalid URSA form target' }` on violation.
- **Structured Multi-Course Query Execution (Branch A)** (Lines 71–116):
  - When `courseCodes` array is supplied, queries `/seat/seat1.cfm` for each code with query parameters `acdyr`, `sem`, `course_code`, `option1`.
  - Passes session cookie and `Referer: https://ursa2.bu.ac.th/seat/seat1.cfm`.
  - Decodes and parses each response into `Course[]`, aggregating and returning `{ ok: true, courses, html }`.
- **Raw Form Proxy Query Execution (Branch B)** (Lines 118–182):
  - Supports GET and POST with URL-encoded parameters.
  - Decodes response via `decodeUrsaResponse` and parses sections with `parseSectionsHtml`.
  - Maps upstream 5xx errors to 502 Bad Gateway.
  - Returns `{ ok: true, courses, html }` with `Cache-Control: no-store, max-age=0`.

---

## 2. Logic Chain

### 2.1 Prohibited Patterns Verification

| Prohibited Pattern | Check Performed | Finding | Status |
|---|---|---|:---:|
| **1. Hardcoded test results** | Grepped `src/app/api/sections/` and `src/lib/ursa/sectionParser.ts` for hardcoded section numbers, fixed seat counts, or constant course results. | No hardcoded section lists or fake query outputs exist. All section data is derived dynamically from parsed HTML. | **PASS** |
| **2. Facade implementations** | Inspected all parser functions and route handlers for dummy stubs or `return <constant>`. | Genuine DOM/regex parsing algorithms, binary Windows-874 decoding, session TTL checks, and SSRF host validations are implemented. | **PASS** |
| **3. Fabricated verification outputs** | Scanned workspace and `.agents/` for pre-computed result artifacts. | No fabricated test logs or artifacts exist. | **PASS** |
| **4. Self-certifying tests** | Reviewed test files in `src/lib/ursa/__tests__/m3_sections.test.ts`. | Tests assert genuine behavior using realistic HTML fragments, entity edge cases, session expiration, and SSRF attack vectors. | **PASS** |
| **5. Execution delegation** | Inspected dependencies in `package.json` and imports in `src/lib/ursa/`. | No external web-scraping or browser automation libraries (Puppeteer/Cheerio/JSDOM) used for parsing. Pure TypeScript implementation. | **PASS** |

### 2.2 Security and Robustness Audit

1. **SSRF Guard (`api/sections/query/route.ts:44-69`)**:
   - Host is restricted to `isAllowedUrsaHost` (`ursa2.bu.ac.th` or `*.bu.ac.th`).
   - Path is strictly locked to `/seat/` prefix.
   - Any external URL or unauthorized internal URL immediately aborts with HTTP 400 Bad Request.

2. **Session Hijacking & Leakage Prevention**:
   - Every route validates `buplaner_session` cookie against `sessionMap` with 1-hour TTL enforcement.
   - All responses set `Cache-Control: no-store, max-age=0` to ensure section availability and session-bound data cannot be cached by intermediate proxies or browsers.

3. **Parser Fault-Tolerance**:
   - Handles empty string, `null`, `undefined`, and malformed tables without uncaught exceptions.
   - ReDoS-safe: all regexes use non-nested, linear patterns with bounds.

---

## 3. Caveats

- In production, upstream ColdFusion responses from `https://ursa2.bu.ac.th/seat/seat1.cfm` depend on live university network availability. When the upstream server is down (5xx), the route handler properly maps the failure to HTTP 502 Bad Gateway with localized Thai feedback.
- `MOCK_COURSES` is referenced exclusively as a static metadata catalog to supply English and Thai course names and credit units for known courses; all sections, seat availability counts, instructors, and rooms are parsed from live HTML tables.

---

## 4. Conclusion

All Milestone 3 deliverables (`src/lib/ursa/sectionParser.ts`, `src/app/api/sections/route.ts`, and `src/app/api/sections/query/route.ts`) have been verified forensically:
- **Zero hardcoded test fixtures** or bypass shortcuts in production code.
- **Genuine parsing and normalization algorithms** for URSA search forms, section tables, days of the week, times, seats, and exam dates.
- **Strict session validation, SSRF security guard, and ColdFusion cookie proxying**.
- **Zero backdoors, zero facades, and full interface contract compliance**.

**VERDICT: CLEAN**

---

## 5. Verification Method

To independently verify this verdict:

1. **Source Inspection**:
   - Inspect `src/lib/ursa/sectionParser.ts` (lines 15–376) to confirm genuine DOM/regex parsing of table cells, seats, days, times, and form controls.
   - Inspect `src/app/api/sections/route.ts` (lines 7–70) and `src/app/api/sections/query/route.ts` (lines 9–195) to confirm session verification, SSRF host & path validation, and upstream proxying.

2. **Automated Test Suite**:
   Run the test runner to execute the comprehensive test suite (including M1, M2, and M3 tests):
   ```bash
   node --import tsx src/lib/ursa/__tests__/run_m3_challenger.ts
   ```

3. **Invalidation Conditions**:
   - Occurrence of hardcoded section arrays in production routes.
   - Absence of session checks on `/api/sections` or `/api/sections/query`.
   - SSRF vulnerability allowing target actions outside `ursa2.bu.ac.th/seat/`.
