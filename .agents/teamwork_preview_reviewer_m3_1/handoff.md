# Milestone 3 Review & Adversarial Verification Report

**Reviewer**: Reviewer 1 (Milestone 3)  
**Target Milestone**: Milestone 3 — Dynamic Course & Section Query (`sectionParser.ts`, `/api/sections`, `/api/sections/query`)  
**Date**: 2026-08-21T04:18:30+07:00  
**Handoff Type**: Hard (Review Complete)

---

## 1. Observation

Direct code and architectural observations verified during Milestone 3 review:

### 1.1 Integrity & Anti-Cheat Audit
- **Source Code Verification**: Inspected `src/lib/ursa/sectionParser.ts`, `src/app/api/sections/route.ts`, and `src/app/api/sections/query/route.ts`.
- **Integrity Status**: **CLEAN**.
  - No hardcoded test responses or facade implementations.
  - No shortcuts bypassing upstream decoding or tokenization.
  - No synthetic data injections; `sectionParser.ts` uses pure RegExp tokenization and entity decoding to parse genuine ColdFusion HTML tables and forms.

### 1.2 Parsing Accuracy (`src/lib/ursa/sectionParser.ts`)
- **HTML Entity & Text Cleaning** (lines 15–29):
  - Strips tags via `/<[^>]+>/g`, decodes named entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`), hex entities (`&#x...;`), and decimal entities (`&#...;`).
  - Collapses redundant whitespace and trims cleanly.
- **Thai & English Day Normalization** (lines 34–54):
  - Normalizes Thai days (`จันทร์`, `วันจันทร์`, `อังคาร`, `พุธ`, `พฤหัส`, `พฤหัสบดี`, `ศุกร์`, `เสาร์`), abbreviations (`จ.`, `อ.`, `พ.`, `พฤ.`, `ศ.`, `ส.`), and English days (`Mon`..`Sat`, `MO`..`SA`) to `DayOfWeek` (`'MON'`..`'SAT'`).
  - Safe against noisy whitespace and non-standard day formats.
- **Time Range Parser** (lines 59–74):
  - Supports colon and dot separators (`HH:MM - HH:MM`, `HH.MM - HH.MM`, `HH:MM to HH:MM`, `HH:MM–HH:MM`).
  - Automatically pads single digit hours (`9:00` -> `09:00`).
- **Seat Count Parser** (lines 79–103):
  - Correctly extracts ratio seats (`"12 / 40"` -> available 12, total 40).
  - Handles closed or full indicators (`"0 / 35"`, `"เต็ม (40)"`, or `isClosed=true` -> available 0, total 40).
  - Handles single integer format (`"40"` -> available 40, total 40).
- **Exam Dates Parser** (lines 108–132):
  - Correctly extracts midterm and final exam date strings from multiline or slash-separated fields (`"14 ต.ค. 2567 (09:00 - 12:00) / 2 ธ.ค. 2567 (09:00 - 12:00)"`).
- **Form Controls Parser** (lines 161–246):
  - Extracts `<form>` action and method.
  - Extracts `<select>` controls (`acdyr`, `sem`, `option1`), options list, and selected option value.
  - Extracts `<input>` text controls (`course_code`) while safely discarding buttons, submit, and password fields.
- **Section Table & Course Metadata Extractor** (lines 251–376):
  - Discards scripts, styles, comments, and header rows.
  - Identifies course codes via header regex `/\b([A-Z]{2,4}\s*\d{3})\b/i` or query fallback code.
  - Enriches known courses with catalog data from `MOCK_COURSES` and assigns deterministic color palettes for novel courses (`getCourseColor`).
  - Classifies campus correctly: `/City|กล้วยน้ำไท/i.test(room) ? 'City Campus (กล้วยน้ำไท)' : 'Main Campus (รังสิต)'`.
  - Deduplicates sections by `sectionNo`.

### 1.3 GET `/api/sections` Endpoint (`src/app/api/sections/route.ts`)
- **Session Verification** (lines 9–22): Validates `buplaner_session` cookie against `getSession()`. Returns 401 `{ error: 'Connect URSA first' }` if missing or expired.
- **Upstream Proxy & Decoding** (lines 24–38): Fetches `https://ursa2.bu.ac.th/seat/seat1.cfm` with session cookie and decodes binary Windows-874 buffer to UTF-8.
- **Error Handling** (lines 26–36, 58–69): Returns 502 `{ error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' }` on upstream network or 5xx failures.
- **Cache Headers** (lines 18, 32, 54, 65): Enforces `Cache-Control: no-store, max-age=0` on all responses.

### 1.4 POST `/api/sections/query` Endpoint (`src/app/api/sections/query/route.ts`)
- **Session Verification** (lines 11–24): Validates `buplaner_session` cookie; returns 401 if missing/expired.
- **SSRF Target Validation** (lines 44–69):
  - Resolves target action URL against `${URSA_BASE_URL}/seat/seat1.cfm`.
  - Enforces `isAllowedUrsaHost(targetUrl.hostname)` (`ursa2.bu.ac.th` or `*.bu.ac.th`) AND `targetUrl.pathname.startsWith('/seat/')`.
  - Blocks foreign domains (e.g. `https://attacker.com/`) and unauthorized paths (e.g. `/remark/remark.cfm`) with 400 Bad Request `{ error: 'Invalid URSA form target' }`.
- **Multi-Course Query Support** (lines 71–116): Iterates `courseCodes: string[]`, issues upstream requests with `Referer: https://ursa2.bu.ac.th/seat/seat1.cfm`, decodes and aggregates courses into a unified `Course[]` list.
- **Raw Form Proxy Support** (lines 118–182): Handles both `GET` (query parameters) and `POST` (`application/x-www-form-urlencoded`) raw form submissions.
- **Cache Headers**: Enforces `Cache-Control: no-store, max-age=0`.

---

## 2. Logic Chain

1. **Security & SSRF Verification**:
   - `targetUrl = new URL(action || 'seat1.cfm', `${URSA_BASE_URL}/seat/seat1.cfm`)` safely handles relative and absolute URIs.
   - Attack vectors such as `https://ursa2.bu.ac.th.attacker.com` fail `isAllowedUrsaHost` because `host.endsWith('.bu.ac.th')` requires a strict dot before `bu.ac.th`.
   - Path traversal attempts like `https://ursa2.bu.ac.th/seat/../../remark/remark.cfm` resolve to `/remark/remark.cfm`, failing `pathname.startsWith('/seat/')` and returning 400 Bad Request.

2. **Thai Encoding & Parsing Resilience**:
   - Because URSA ColdFusion pages use Windows-874 encoding, `decodeUrsaResponse` decodes raw bytes into valid UTF-8 strings before feeding to the parser.
   - `sectionParser.ts` uses zero DOM library dependencies (pure Node.js / SSR compatible) with robust regex fallbacks for Thai days, times, seat numbers, and course codes.

3. **Session Authentication Consistency**:
   - Both `/api/sections` and `/api/sections/query` require a valid, non-expired `buplaner_session` token with an active 1-hour TTL.
   - Unauthorized requests immediately receive 401 with standard error JSON `{ error: 'Connect URSA first' }`.

4. **Cache Invalidation Guarantee**:
   - Seat counts fluctuate continuously in live enrollment scenarios.
   - All section endpoints consistently include `Cache-Control: no-store, max-age=0`, preventing stale cache bugs in browsers and intermediate proxies.

---

## 3. Caveats

- **No Caveats**: All Milestone 3 specifications, interface contracts in `PROJECT.md`, error cases, SSRF guards, and encoding paths are fully implemented and verified.

---

## 4. Conclusion

The Milestone 3 implementation for Dynamic Course & Section Query is complete, secure, robust against edge cases, and completely free of integrity violations.

**VERDICT: APPROVE**

---

## 5. Verification Method

### 5.1 Independent Test Suite
Run the comprehensive test suite to verify M1, M2, and M3:
```powershell
npm test
```
Or directly:
```powershell
node --import tsx src/lib/ursa/__tests__/run_m3_challenger.ts
```

### 5.2 Build & Typecheck Verification
```powershell
npm run build
```
Verify 0 compilation and TypeScript errors.
