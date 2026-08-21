# Handoff Report: Milestone 3 — Dynamic Course & Section Query Implementation

**Author**: Worker Agent (Milestone 3)  
**Target Modules**:
- `src/lib/ursa/sectionParser.ts`
- `src/app/api/sections/route.ts`
- `src/app/api/sections/query/route.ts`
- `src/lib/ursa/__tests__/m3_sections.test.ts`
- `src/lib/ursa/__tests__/run_m3_challenger.ts`  
**Date**: 2026-08-21T04:16:00+07:00  
**Handoff Type**: Hard (Implementation Complete & Verified)

---

## 1. Observation

Direct code and architectural observations verified during Milestone 3 implementation:

### 1.1 Specification & Requirements Alignment
- **URSA Section Endpoint**: `GET https://ursa2.bu.ac.th/seat/seat1.cfm` returns HTML form metadata for academic year and term selection, decoded via `windows-874`.
- **Search Query Endpoint**: `POST /api/sections/query` receives either:
  1. Multi-course array queries (`courseCodes: string[]`, `academicYear`, `semester`, `option1`), querying upstream sequentially/concurrently and returning aggregated `Course[]`.
  2. Raw form proxy submissions (`fields: Record<string, string>`, `action: string`, `method: string`).
- **Security & SSRF Guard**: Whitelist validation requires target URL hostname to pass `isAllowedUrsaHost(hostname)` (must match `ursa2.bu.ac.th` or `*.bu.ac.th`) and pathname to start with `/seat/`. Any invalid or external host (e.g. `https://attacker.com/steal`) is rejected with `400 Bad Request`.
- **Session Authentication**: All section endpoints require active `buplaner_session` cookie verified via `getSession(sessionId)`. Returns `401 Unauthorized` with `{ error: 'Connect URSA first' }` if missing or expired.
- **Cache Headers**: Responses return `Cache-Control: no-store, max-age=0` to ensure live, non-stale seat availability.

### 1.2 Implemented Files & Code References
1. **`src/lib/ursa/sectionParser.ts`**:
   - `cleanHtmlText`: Strips HTML tags (`<[^>]+>`), decodes named entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) and numeric entities (`&#xHEX;`, `&#DEC;`), collapses whitespace.
   - `normalizeDayOfWeek`: Maps Thai day names (`จันทร์`, `อังคาร`, `พุธ`, `พฤหัส`, `ศุกร์`, `เสาร์`), abbreviations (`จ.`, `อ.`, `พ.`, `พฤ.`, `ศ.`, `ส.`), and English days (`Mon`..`Sat`, `MO`..`SA`) to `DayOfWeek` (`MON`..`SAT`).
   - `parseTimeRange`: Parses `HH:MM - HH:MM`, `HH.MM - HH.MM`, and `HH:MM to HH:MM` into standard `{ startTime: "HH:MM", endTime: "HH:MM" }`.
   - `parseSeatCount`: Parses ratio `"12 / 40"` -> `{ availableSeats: 12, totalSeats: 40 }`, single numbers `"40"`, closed status `"0 / 40"` or `"เต็ม (40)"` -> `{ availableSeats: 0, totalSeats: 40 }`.
   - `parseExamDates`: Extracts midterm and final exam schedules from raw text.
   - `parseUrsaForm`: Extracts `<form>`, `<select>` (with options and selected values), and `<input>` controls from `/seat/seat1.cfm`.
   - `parseSectionsHtml`: Extracts candidate tables matching `/Seat\(s\)/i` and `/Status/i`, identifies Course Code, enriches metadata from `MOCK_COURSES` or palette generator, parses rows into `Section` objects, and deduplicates sections by `sectionNo`.

2. **`src/app/api/sections/route.ts`**:
   - Next.js App Router GET route handler.
   - Validates `buplaner_session` cookie via `getSession()`.
   - Proxies GET `https://ursa2.bu.ac.th/seat/seat1.cfm` with session cookie and decodes via `decodeUrsaResponse`.
   - Parses form controls via `parseUrsaForm(html)`.
   - Returns 200 `{ ok: true, html, form }` with `Cache-Control: no-store, max-age=0`.
   - Handles upstream errors with 502 `{ error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' }`.

3. **`src/app/api/sections/query/route.ts`**:
   - Next.js App Router POST route handler.
   - Validates `buplaner_session` cookie via `getSession()`.
   - Validates SSRF target whitelist: `isAllowedUrsaHost(targetUrl.hostname)` and `targetUrl.pathname.startsWith('/seat/')`.
   - Handles both `courseCodes` array queries and single `fields` raw form proxy queries.
   - Forwards queries with `session.cookie` and `Referer: https://ursa2.bu.ac.th/seat/seat1.cfm`.
   - Decodes response via `decodeUrsaResponse` and parses courses via `parseSectionsHtml`.
   - Returns 200 `{ ok: true, courses: Course[], html: string }` with `Cache-Control: no-store, max-age=0`.
   - Handles upstream errors with 502 `{ error: 'ไม่สามารถค้นหา Section ได้ในขณะนี้' }`.

4. **`src/lib/ursa/__tests__/m3_sections.test.ts` & `run_m3_challenger.ts`**:
   - 9 test suites covering text cleaning, day normalization, time parsing, seat counting, exam date extraction, form parsing, section table parsing, GET `/api/sections`, and POST `/api/sections/query`.
   - Integrated test runner checking M1, M2, and M3.

---

## 2. Logic Chain

1. **Server-Side Compatibility (Pure Regex & Tokenization)**:
   - Next.js App Router runs in Node.js server environments where browser `window.DOMParser` does not exist.
   - `sectionParser.ts` uses pure regular expression and string tokenizer logic without external dependencies like `jsdom`, ensuring identical execution in Node.js server runtime, test runners, and client environments.

2. **Resilient Course Code & Section Extraction**:
   - Tables in URSA ColdFusion output often have titles above the table (`CS441 Algorithms Analysis and Design`) or inside table headers.
   - `parseSectionsHtml` first inspects table text and surrounding HTML for course code patterns (`/\b[A-Z]{2,4}\d{3}\b/`), and falls back to `fallbackCourseCode` if provided by the query.
   - Known courses are enriched with Thai and English descriptions, categories, and colors from `MOCK_COURSES`; unknown courses receive deterministic palette colors via string hashing.

3. **SSRF Guard & Upstream Security**:
   - User-supplied `action` parameters are parsed into a `URL` object resolved against `${URSA_BASE_URL}/seat/seat1.cfm`.
   - The hostname is checked against `isAllowedUrsaHost` (`ursa2.bu.ac.th` or `*.bu.ac.th`) and pathname must start with `/seat/`.
   - Out-of-bounds endpoints (like `/remark/remark.cfm` or external URLs) return `400 Bad Request`, preventing server-side request forgery.

4. **Dual Query Modes (Multi-Course & Raw Proxy)**:
   - If `courseCodes: string[]` is provided, the API executes queries for each course, decodes responses, parses sections, and returns an aggregated list of `Course[]`.
   - If `fields: Record<string, string>` is provided, the API proxies raw form fields directly to the target URL and returns parsed `Course[]`.

---

## 3. Caveats

1. **Mock Course Enrichment**:
   - When URSA returns a course matching a code in `src/data/mockCourses.ts`, full catalog metadata (Thai name, faculty, prerequisites) is attached to the live sections. For novel courses not in the catalog, default fallback fields (`category: 'IT_COMPUTING'`, generated color) are used.
2. **Upstream Network Dependencies**:
   - When live URSA servers are offline or timing out, endpoints return HTTP 502 with clear Thai error messages.

---

## 4. Conclusion

Milestone 3 (Dynamic Course & Section Query) is fully implemented:
- Pure DOM/Regex parser `src/lib/ursa/sectionParser.ts` is implemented and exports all required functions.
- Route handler `GET /api/sections` is implemented at `src/app/api/sections/route.ts`.
- Route handler `POST /api/sections/query` is implemented at `src/app/api/sections/query/route.ts`.
- Comprehensive test suite `src/lib/ursa/__tests__/m3_sections.test.ts` and runner `src/lib/ursa/__tests__/run_m3_challenger.ts` are ready.
- All code follows strict Next.js App Router and TypeScript conventions with zero external package bloat.

---

## 5. Verification Method

### 5.1 Verification Test Suite
Run the test runner to execute M1, M2, and M3 test suites:
```powershell
npm test
```
or
```powershell
node --import tsx src/lib/ursa/__tests__/run_m3_challenger.ts
```

### 5.2 Build Conformance
```powershell
npm run build
```

### 5.3 Test Cases Verified in `m3_sections.test.ts`:
1. `Parser:CleanText`: Strips HTML tags, collapses whitespace, decodes named & numeric HTML entities.
2. `Parser:NormalizeDay`: Validates all Thai day variations (จันทร์, อังคาร, พุธ, พฤหัส, ศุกร์, เสาร์) and English days (Mon..Sat, MO..SA).
3. `Parser:TimeRange`: Validates colon/dot formats (`09:00 - 12:00`, `09.00 - 12.00`, `13:30-16:30`, `13.30–16.30`).
4. `Parser:SeatCount`: Validates ratio `12 / 40`, closed status `0 / 35`, single number `40`, and `เต็ม (40)`.
5. `Parser:ExamDates`: Validates midterm and final exam extraction from multiline and slash strings.
6. `Parser:UrsaForm`: Validates `<form>`, `<select>` (`acdyr`, `sem`, `option1`) and `<input>` (`course_code`) extraction.
7. `Parser:SectionTable`: Validates table parsing, section mapping, closed seat handling, Lab classification, City campus detection, fallback codes, novel courses, and malformed HTML handling.
8. `Route:Sections`: Validates GET 401 without cookie, 401 on expired session, 200 with form JSON on active session, 502 on upstream failure.
9. `Route:Query`: Validates POST 401 without cookie, 400 on SSRF attempts, 200 on raw form queries, 200 on multi-course queries, and 502 on upstream errors.
