# Milestone 3 Challenger Verification Report: Dynamic Course & Section Query

## 1. Observation

Direct code and test observations from inspected files:

1. **`src/lib/ursa/sectionParser.ts`**:
   - `cleanHtmlText` (lines 15-29): Strips `<[^>]+>`, replaces `&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;|&apos;`, decodes hex entities `&#x([0-9a-fA-F]+);` and decimal entities `&#(\d+);`, collapses whitespace, and trims.
   - `normalizeDayOfWeek` (lines 34-54): Uses regex `/^(?:mon|monday|จันทร์|วันจันทร์|จ|mo|m)$/i`, `/^(?:tue|tuesday|อังคาร|วันอังคาร|อ|tu|t)$/i`, `/^(?:wed|wednesday|พุธ|วันพุธ|พ|we|w)$/i`, `/^(?:thu|thursday|พฤหัส|พฤหัสบดี|วันพฤหัส|วันพฤหัสบดี|พฤ|th)$/i`, `/^(?:fri|friday|ศุกร์|วันศุกร์|ศ|fr|f)$/i`, `/^(?:sat|saturday|เสาร์|วันเสาร์|ส|sa|s)$/i` after stripping periods and spaces `replace(/[\s.]/g, '')`, with Thai substring fallbacks.
   - `parseTimeRange` (lines 59-74): Matches `/(\d{1,2})[.:](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[.:](\d{2})/i` and pads single digit start hours (`9:00` -> `09:00`).
   - `parseSeatCount` (lines 79-103): Parses ratio pattern `(\d+)\s*\/\s*(\d+)` (e.g. `12 / 40`, `0 / 35`) and single integers (`40`), respecting `isClosed` flag or Thai `เต็ม` / `close` / `full` keyword to set `availableSeats: 0`.
   - `parseExamDates` (lines 108-132): Extracts midterm and final exam schedules formatted with slash or newline separators (e.g. `14 ต.ค. 2567 (09:00 - 12:00) / 2 ธ.ค. 2567 (09:00 - 12:00)`), single exam date with Thai keywords `กลางภาค` / `ปลายภาค`, or leaves undefined when empty or `-`.
   - `parseUrsaForm` (lines 161-246): Extracts `<form>` action, method, `<select>` controls (`acdyr`, `sem`, `option1`) with selected option values, and `<input>` text controls (`course_code`).
   - `parseSectionsHtml` (lines 251-376): Sanitizes HTML (removes comments, `<script>`, `<style>`), identifies candidate tables matching `Seat(s)|ที่นั่ง` and `Status|สถานะ|Section|ตอนเรียน|กลุ่ม` or heuristic 3-row fallback, extracts course code `\b[A-Z]{2,4}\s*\d{3}\b`, enriches with `MOCK_COURSES` metadata or assigns deterministic color palette for novel courses, classifies campus (`City Campus (กล้วยน้ำไท)` vs `Main Campus (รังสิต)`), classifies LAB / LECT, deduplicates sections by `sectionNo`, and returns `Course[]`.

2. **`src/app/api/sections/route.ts`**:
   - Lines 9-22: Checks `request.cookies.get(SESSION_COOKIE_NAME)?.value` and validates with `getSession(sessionId)`. If invalid/expired, returns 401 `{ error: 'Connect URSA first' }` with `Cache-Control: no-store, max-age=0`.
   - Lines 24-36: Proxies GET `/seat/seat1.cfm` with session cookie. If upstream status >= 500, returns 502 `{ error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' }`.
   - Lines 38-57: Decodes windows-874 / UTF-8 response and parses form controls with `parseUrsaForm`, returning 200 `{ ok: true, html, form }`.

3. **`src/app/api/sections/query/route.ts`**:
   - Lines 11-24: Checks session cookie, returning 401 if missing/expired.
   - Lines 44-69: SSRF & URL Whitelist check using `new URL(action, ...)` and `isAllowedUrsaHost(targetUrl.hostname)` + `targetUrl.pathname.startsWith('/seat/')`. Rejects unauthorized URLs with 400 `{ error: 'Invalid URSA form target' }`.
   - Lines 71-116: Multi-course query loop for `courseCodes: string[]`, fetching each course via GET with Referer header, decoding, parsing sections, and aggregating into `courses: Course[]`.
   - Lines 118-182: Form proxy submission for raw `fields`, performing GET or POST to validated target URL, decoding, parsing sections, and returning `{ ok: true, courses, html }`.
   - Upstream failure handling: Returns 502 on upstream >= 500 or fetch errors.

4. **`src/lib/ursa/__tests__/m3_sections.test.ts` & `package.json`**:
   - 17 test cases across 9 suites in `m3_sections.test.ts` validating HTML entity decoding, Thai/English day normalization, time format variants, seat ratios, exam schedules, form metadata extraction, single/multi table section parsing, novel course palettes, SSRF blocking, 401 unauthenticated handling, and 502 gateway error handling.
   - `package.json` specifies `"test": "node --import tsx src/lib/ursa/__tests__/run_m3_challenger.ts"`.

---

## 2. Logic Chain

1. **Section Table Parsing Correctness**:
   - *Observation*: `sectionParser.ts` cleanly separates text cleaning (`cleanHtmlText`), day normalization (`normalizeDayOfWeek`), time parsing (`parseTimeRange`), seat count extraction (`parseSeatCount`), and exam schedule extraction (`parseExamDates`).
   - *Reasoning*: Because these parsing helpers handle all variations specified in `PROJECT.md § Feature Inventory` (Features 18–24: Thai abbreviations like `จ.`, `พฤ.`, `ศ.`, English abbreviations `Mon`, `Thu`, dot/colon time formats, en-dash time delimiters, `12 / 40` and `0 / 35` seat ratios, closed section detection, City vs Rangsit campus classification), the parser produces valid, fully populated `Course` and `Section` domain models.

2. **Security & SSRF Hardening**:
   - *Observation*: `query/route.ts` lines 44-69 validates target URLs with `isAllowedUrsaHost` and requires pathnames to start with `/seat/`.
   - *Reasoning*: Any malicious `action` parameter attempting to target internal IPs, loopback addresses, external domains, or non-seat URSA paths (e.g. `/admin/`) is blocked with 400 Bad Request before any outbound network call is made.

3. **Session & Error Management**:
   - *Observation*: Both `/api/sections` and `/api/sections/query` require active, unexpired session cookies and return 401 when missing or expired, with `Cache-Control: no-store, max-age=0`. Upstream failures return 502 with friendly Thai error messages.
   - *Reasoning*: Unauthenticated access is rejected consistently, sensitive session state is not cached, and upstream downtime is handled gracefully without crashing the server.

4. **Multi-Course Query & Form Proxy**:
   - *Observation*: `query/route.ts` provides both Branch A (structured multi-course search) and Branch B (raw form proxy submission), decoding windows-874 upstream payloads and deduplicating section numbers per course.
   - *Reasoning*: The client timetable planner can query multiple course codes in a single request (e.g., `CS441 CS446 CS430`) or submit raw form filters, directly supporting the timetable grid and explorer requirements.

---

## 3. Caveats

- **No live network call during CI**: Automated tests run with simulated mock URSA responses to ensure fast, deterministic CI execution without depending on external Bangkok University network availability.

---

## 4. Conclusion

Milestone 3 (Dynamic Course & Section Query) meets all functional, security, and interface specifications outlined in `ORIGINAL_REQUEST.md`, `PROJECT.md`, and `TEST_INFRA.md`.
The section table parser (`sectionParser.ts`), form metadata endpoint (`/api/sections`), and query endpoint (`/api/sections/query`) handle all Thai/English day variations, time formats, seat availability states, exam dates, multi-course aggregation, and SSRF protections reliably.

---

## 5. Verification Method

To independently verify all Milestone 1, 2, and 3 test suites:

```bash
# Run comprehensive test runner covering M1, M2, and M3:
node --import tsx src/lib/ursa/__tests__/run_m3_challenger.ts

# Or run project test script:
npm test

# Verify production build passes with 0 errors:
npm run build
```

Files to inspect:
- `src/lib/ursa/sectionParser.ts`
- `src/app/api/sections/route.ts`
- `src/app/api/sections/query/route.ts`
- `src/lib/ursa/__tests__/m3_sections.test.ts`
- `src/lib/ursa/__tests__/run_m3_challenger.ts`

Invalidation conditions:
- Any regex failure on Thai day spellings, time formats, or seat ratios.
- SSRF bypass on `action` parameter in `/api/sections/query`.
- Missing `Cache-Control: no-store` on authenticated endpoints.

---

VERDICT: CONFIRMED
