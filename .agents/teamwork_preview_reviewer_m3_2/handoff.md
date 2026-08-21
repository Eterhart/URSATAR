# Milestone 3 Review & Adversarial Assessment Report (Reviewer 2)

**Reviewer**: Reviewer 2 (Teamwork Agent)  
**Target Milestone**: Milestone 3 — Dynamic Course & Section Query  
**Target Modules**:
- `src/lib/ursa/sectionParser.ts`
- `src/app/api/sections/route.ts`
- `src/app/api/sections/query/route.ts`
- `src/types/ursa.ts` & `src/types/schedule.ts`
- `src/lib/ursa/__tests__/m3_sections.test.ts`
**Date**: 2026-08-21T04:19:00+07:00  
**Handoff Type**: Hard (Review Complete)

---

## 1. Observation

Direct inspection of the Milestone 3 implementation reveals:

### 1.1 Security & Session Management
- **Session Verification**: Both `GET /api/sections` (`src/app/api/sections/route.ts:9-22`) and `POST /api/sections/query` (`src/app/api/sections/query/route.ts:11-24`) extract the `buplaner_session` cookie and validate it against `getSession(sessionId)`.
  - Missing or expired sessions (> 1h TTL) immediately return HTTP `401 Unauthorized` with body `{ error: "Connect URSA first" }` and header `Cache-Control: no-store, max-age=0`.
- **SSRF Guard**: `POST /api/sections/query` (`src/app/api/sections/query/route.ts:44-69`) verifies target action URLs against `isAllowedUrsaHost(targetUrl.hostname)` and enforces `targetUrl.pathname.startsWith('/seat/')`.
  - External hostnames (e.g. `https://attacker.com/leak`), non-BU domains, and non-seat paths (e.g. `https://ursa2.bu.ac.th/remark/remark.cfm` or `/admin/`) are blocked with HTTP `400 Bad Request` `{ error: "Invalid URSA form target" }`.
- **Upstream Session Isolation**: ColdFusion session cookies (`CFID`, `CFTOKEN`) stored in memory are injected on the server side into upstream requests without exposing raw upstream cookies to client JS.

### 1.2 Parsing Robustness & Edge-Case Handling (`src/lib/ursa/sectionParser.ts`)
- **Entity & Tag Cleaning (`cleanHtmlText`)**: Strips tags via regex `<[^>]+>`, decodes named entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) as well as hex (`&#x...;`) and decimal (`&#...;`) numeric entities, collapses whitespace, and gracefully handles `null`, `undefined`, or empty string inputs.
- **Day of Week Normalization (`normalizeDayOfWeek`)**: Full mapping coverage for Thai day names (`จันทร์`..`เสาร์`, `วันจันทร์`..`วันเสาร์`, `จ.`..`ส.`), English names (`Mon`..`Sat`, `Monday`..`Saturday`, `MO`..`SA`), with regex and substring matching for noisy formatting.
- **Time Range Parser (`parseTimeRange`)**: Parses both colon (`09:00 - 12:00`) and dot notation (`09.00 - 12.00`), en-dash (`–`), em-dash (`—`), hyphen (`-`), 'to', and pads single-digit hours to standard `HH:MM`.
- **Seat Availability Parser (`parseSeatCount`)**: Handles ratio formats (`12 / 40`, `0 / 35`), single integer (`40`), and closed status words (`เต็ม`, `close`, `full`) to set `availableSeats: 0`.
- **Exam Dates Extractor (`parseExamDates`)**: Parses slash (`/`) and newline delimited midterm and final examination schedules.
- **Section Table Detection (`parseSectionsHtml`)**: Detects tables with header keywords `/Seat\(s\)|ที่นั่ง/i` and `/Status|สถานะ|Section|ตอนเรียน|กลุ่ม/i`, extracts course codes from table/title or fallback query fields, enriches catalog metadata from `MOCK_COURSES`, generates deterministic palette colors for novel courses, detects `City Campus` vs `Main Campus` from room names, and deduplicates sections by `sectionNo`.
- **Zero-Row & Malformed HTML**: Handles non-matching or empty HTML gracefully by returning `[]` without throwing uncaught exceptions.

### 1.3 Error Mapping & HTTP Statuses
- `401 Unauthorized`: Session missing or expired in `sessionStore`.
- `400 Bad Request`: SSRF violation or malformed target URL in `/api/sections/query`.
- `502 Bad Gateway`: Upstream 5xx status or network failure with localized Thai error messages (`ไม่สามารถดึงข้อมูล Course Sections ได้` / `ไม่สามารถค้นหา Section ได้ในขณะนี้`).
- `200 OK`: Successful form retrieval (`{ ok: true, html, form }`) or query search (`{ ok: true, courses: Course[], html }`).
- All route responses set `Cache-Control: no-store, max-age=0`.

### 1.4 Type Safety & Next.js Conventions
- Adheres to Next.js App Router conventions with typed `NextRequest` and `NextResponse`.
- Uses shared domain types (`Course`, `Section`, `DayOfWeek` in `@/types/schedule` and `UrsaForm`, `UrsaFormControl`, `UrsaQueryRequest`, `UrsaQueryResponse` in `@/types/ursa`).
- Pure TypeScript implementation with zero external runtime dependencies.

---

## 2. Logic Chain

1. **Adversarial Integrity Verification**:
   - Analyzed `src/lib/ursa/sectionParser.ts`, `src/app/api/sections/route.ts`, and `src/app/api/sections/query/route.ts` for dummy facades, bypasses, or hardcoded mock responses.
   - Parsing is performed dynamically over the input HTML string; route handlers make live upstream `fetchUrsa` calls with session credentials. No integrity violations found.

2. **Security & Boundary Analysis**:
   - Evaluated `isAllowedUrsaHost`: only hostnames matching `ursa2.bu.ac.th` or ending in `.bu.ac.th` are permitted.
   - Evaluated pathname restriction: target URL pathname MUST start with `/seat/`. Path traversal sequences (`/seat/../admin`) are resolved by standard `URL` resolution before the check, preventing SSRF escapes.
   - Evaluated session TTL: `sessionStore.ts` checks `Date.now() - session.createdAt > 3600000`, guaranteeing 1-hour expiration.

3. **Robustness & Failure Mode Analysis**:
   - Assessed edge cases including empty HTML strings, tables with missing columns, invalid day/time formats, zero available seats, and uncataloged courses.
   - Fallbacks exist at every layer (`cleanHtmlText` -> `''`, `normalizeDayOfWeek` -> `null`, `parseTimeRange` -> `null` / defaults, `parseSectionsHtml` -> safe defaults and deterministic color generation).

---

## 3. Caveats

- Upstream URSA server responses rely on network availability; when URSA is down or unreachable, route handlers return 502 Bad Gateway with localized Thai messages.
- The route handler uses Node.js standard `fetch` with AbortSignal timeout (10,000ms default) ensuring requests do not hang indefinitely.

---

## 4. Conclusion

The Milestone 3 implementation fully satisfies all functional requirements (R3), security constraints, type safety contracts, and App Router standards:
- SSRF guard and 1h session verification are securely enforced.
- Section table parsing and form extraction handle all Thai/English variations, closed sections, and malformed tables gracefully.
- Error codes (401, 400, 502) and `Cache-Control` headers conform to specification.

**VERDICT: APPROVE**

---

## 5. Verification Method

To independently execute and verify the test suites:
```powershell
# Run full M1, M2 & M3 test suites
npm test
```
or
```powershell
node --import tsx src/lib/ursa/__tests__/run_m3_challenger.ts
```

Build verification:
```powershell
npm run build
```
