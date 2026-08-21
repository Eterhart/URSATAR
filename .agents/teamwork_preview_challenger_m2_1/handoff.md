# Milestone 2 Challenger 1 Handoff Report

## 1. Observation

Direct examination and empirical test harness construction were conducted on the Milestone 2 Student Profile Fetcher implementation across the following files:
- `src/lib/ursa/profileParser.ts` (Lines 1–208)
- `src/app/api/profile/route.ts` (Lines 1–71)
- `src/lib/ursa/__tests__/m2_profile.test.ts` (Lines 1–505)
- `src/lib/ursa/__tests__/run_m2_challenger.ts` (Lines 1–44)
- `src/types/ursa.ts` (Lines 1–89)

### Key Observations:
1. **HTML Entity and Text Sanitation (`cleanHtmlText`)**:
   - `src/lib/ursa/profileParser.ts:19-33`: Strips HTML tags (`/<[^>]+>/g`), decodes named entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`), hex numeric entities (`/&#x([0-9a-fA-F]+);/g`), and decimal numeric entities (`/&#(\d+);/g`).
   - Normalizes arbitrary whitespace (`/\s+/g`) into single spaces and trims edges.

2. **Table & Cell Scoping (`parseProfileHtml`)**:
   - `src/lib/ursa/profileParser.ts:51-74`: Sanitizes HTML by stripping `<script>`, `<style>`, and `<!-- comments -->` blocks before inspection.
   - Accurately targets the Grade Report table (`/Grade\s*Report/i` or `/Student\s*ID|รหัสนักศึกษา/i` and `/\bName\b|ชื่อ/i`).
   - If no enclosing table tag is matched (e.g. malformed HTML or raw divs), defaults `searchScope` safely to `sanitizedHtml` without throwing.

3. **Label Matching & Collision Protection**:
   - `src/lib/ursa/profileParser.ts:85-154`: Scans table cells (`<td>` and `<th>`) for bilingual English/Thai keys:
     - Student ID: `^(?:Student\s*ID|รหัสนักศึกษา|Student\s*Code|ID)\s*:?$`
     - Name: `^(?:Name|ชื่อ-สกุล|ชื่อ|Student\s*Name|ชื่อ\s*-\s*สกุล)\s*:?$`
     - Faculty: `^(?:Faculty|คณะ)\s*:?$`
     - Department: `^(?:Department|สาขาวิชา|สาขา|ภาควิชา|Major)\s*:?$`
   - Employs negative lookahead guards (`!/^(?:Name|ชื่อ|Faculty|Department)/i.test(val)`) preventing empty cells or adjacent header keys from being erroneously assigned as student values.
   - Supports both adjacent-cell key-value pairs and single-cell combined strings (e.g. `Student ID: 1650701234`).

4. **Regex Fallbacks & Meta Generation**:
   - `src/lib/ursa/profileParser.ts:156-205`: Provides robust regex fallback extracting BU 10-digit IDs (`/\b(1\d{9})\b/`) and student names from unstructured HTML bodies.
   - Formats `meta` consistently as `Student ID <id>` when present, defaulting to `'ข้อมูลจาก URSA'` when absent.

5. **Route Handler Security & Error Resilience (`/api/profile`)**:
   - `src/app/api/profile/route.ts:9-22`: Checks `SESSION_COOKIE_NAME` against `getSession(sessionId)`. Rejects absent, invalid, or expired sessions with HTTP 401 Unauthorized (`{ error: 'Connect URSA first' }`) and `Cache-Control: no-store, max-age=0`.
   - `src/app/api/profile/route.ts:24-36`: Forwards authenticated cookies to `https://ursa2.bu.ac.th/remark/remark.cfm`. Catches upstream 5xx responses and network failures, returning HTTP 502 Bad Gateway with Thai error feedback (`{ error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' }`).
   - `src/app/api/profile/route.ts:38-57`: Decodes windows-874 body via `decodeUrsaResponse` and returns structured JSON with `ok: true`, `studentId`, `studentName`, `meta`, `faculty`, `department`, and `html`.

---

## 2. Logic Chain

1. **Adversarial Input Resilience**:
   - Empty/null/undefined inputs return `{ studentId: '', studentName: '', meta: 'ข้อมูลจาก URSA' }` without runtime exceptions.
   - Malicious script/style injection or fake IDs embedded inside HTML comments are stripped prior to table/cell extraction.
   - Malformed tables with unclosed `<td>` or `<tr>` tags successfully fall back to regex extraction, extracting correct 10-digit IDs and Thai names.
   - Entity-encoded Thai names (such as numeric entities from legacy ColdFusion pages) are properly decoded into UTF-8 Thai strings.

2. **Integration & API Specification Compliance**:
   - The route handler adheres to the contract specified in `PROJECT.md § Interface Contracts (Profile Module)`:
     - `GET /api/profile` returns `{ ok: true, studentId, studentName, meta, faculty, department, html }`.
     - Unauthorized requests yield HTTP 401 `{ error: "Connect URSA first" }`.
     - Upstream errors yield HTTP 502 `{ error: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" }`.
     - All responses include `Cache-Control: no-store, max-age=0`.

3. **Stress Testing Suite Coverage**:
   - Extended `src/lib/ursa/__tests__/m2_profile.test.ts` to 21 automated test cases encompassing unit cleaning, DOM parsing, adversarial injection, label collision, noisy whitespace, multi-table layouts, and route handler simulation.

---

## 3. Caveats

- Upstream URSA server (`ursa2.bu.ac.th`) availability depends on Bangkok University internal network state; mock fetch handlers verify behavior across 200, 500, and network exception scenarios.
- The parser expects student IDs to match standard Bangkok University 8-12 digit patterns (specifically BU 10-digit IDs starting with 1). Unconventional non-numeric IDs would rely on adjacent cell labels rather than the BU regex fallback.

---

## 4. Conclusion

The Milestone 2 Student Profile Fetcher implementation in `src/lib/ursa/profileParser.ts` and `src/app/api/profile/route.ts` is robust, secure, and resilient against diverse HTML variations, malformed structures, Thai encoding quirks, and adversarial noise.

---

## 5. Verification Method

To verify the test suite:
1. Run: `node --import tsx src/lib/ursa/__tests__/run_m2_challenger.ts`
2. Run: `npm test`
3. Inspect `src/lib/ursa/profileParser.ts` and `src/app/api/profile/route.ts`.

VERDICT: CONFIRMED
