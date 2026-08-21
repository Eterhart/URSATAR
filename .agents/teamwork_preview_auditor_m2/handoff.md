# Forensic Audit Report: Milestone 2 — Student Profile Fetcher

**Work Product**: `src/lib/ursa/profileParser.ts`, `src/app/api/profile/route.ts`, `src/types/ursa.ts`  
**Profile**: General Project  
**Integrity Mode**: Development / Demo Mode (Reference implementation integration)  
**Verdict**: `VERDICT: CLEAN`

---

## 1. Observation

A comprehensive forensic audit was conducted on Milestone 2 implementation across the codebase:

### 1.1 Target Source Files
1. **`src/lib/ursa/profileParser.ts` (Lines 1–208)**:
   - **Entity and Tag Sanitation (`cleanHtmlText`)** (Lines 19–33):
     - Uses standard regex replace `/<[^>]+>/g` to strip tags.
     - Decodes named HTML entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`).
     - Decodes hexadecimal numeric entities `&#x([0-9a-fA-F]+);` via `String.fromCharCode(parseInt(hex, 16))`.
     - Decodes decimal numeric entities `&#(\d+);` via `String.fromCharCode(Number(code))`.
     - Normalizes arbitrary whitespace sequences `/\s+/g` into single spaces and trims ends.
   - **DOM & Regex Parsing (`parseProfileHtml`)** (Lines 40–207):
     - Sanitizes HTML by stripping `<script>`, `<style>`, and `<!-- comments -->` (Lines 52–55).
     - Identifies target Grade Report table using regex matching `/Grade\s*Report/i` and (`/Student\s*ID|รหัสนักศึกษา/i` + `/\bName\b|ชื่อ/i`) (Lines 58–71).
     - Extracts `<td>` and `<th>` cells into an array and scans adjacent cells for bilingual headers:
       - Student ID: `^(?:Student\s*ID|รหัสนักศึกษา|Student\s*Code|ID)\s*:?$`
       - Name: `^(?:Name|ชื่อ-สกุล|ชื่อ|Student\s*Name|ชื่อ\s*-\s*สกุล)\s*:?$`
       - Faculty: `^(?:Faculty|คณะ)\s*:?$`
       - Department: `^(?:Department|สาขาวิชา|สาขา|ภาควิชา|Major)\s*:?$`
     - Implements label collision guard `!/^(?:Name|ชื่อ|Faculty|Department)/i.test(val)` ensuring header labels are never captured as student data (Lines 93, 101, 109, 117).
     - Handles single-cell combined formats `Label: Value` (Lines 122–153).
     - Provides fallback regexes for unstructured layouts matching BU 10-digit IDs (`/\b(1\d{9})\b/` or `/(?:Student\s*ID|รหัสนักศึกษา)[\s:]*([0-9]{8,12})/i`) (Lines 157–197).
     - Formats meta string as `Student ID ${studentId}` or fallback `ข้อมูลจาก URSA` (Lines 199–205).
     - Returns default empty strings without throwing on empty/null/corrupted input (Lines 47–49).

2. **`src/app/api/profile/route.ts` (Lines 1–71)**:
   - **Session Verification** (Lines 9–22):
     - Extracts cookie `buplaner_session` from incoming `NextRequest`.
     - Validates session with `getSession(sessionId)` from `sessionStore.ts`, checking 1-hour TTL expiration.
     - Returns HTTP 401 Unauthorized `{ error: 'Connect URSA first' }` with `Cache-Control: no-store, max-age=0` if session is missing or expired.
   - **Upstream Proxy & Response Decoding** (Lines 24–40):
     - Dispatches authenticated GET request to `https://ursa2.bu.ac.th/remark/remark.cfm` with `session.cookie` via `fetchUrsa`.
     - Detects upstream 5xx errors and returns HTTP 502 Bad Gateway with Thai message `{ error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' }`.
     - Decodes binary response buffer from windows-874 to UTF-8 string using `decodeUrsaResponse(response)`.
     - Parses decoded HTML with `parseProfileHtml(html)`.
   - **Response Payload & Headers** (Lines 41–57):
     - Returns HTTP 200 JSON with `{ ok: true, studentId, studentName, meta, faculty, department, html }`.
     - Attaches `Cache-Control: no-store, max-age=0` to prevent sensitive student data caching.
   - **Exception Handling** (Lines 58–69):
     - Catches network timeouts/exceptions and returns HTTP 502 Bad Gateway with Thai error feedback.

3. **`src/types/ursa.ts` (Lines 31–47)**:
   - Defines `UrsaProfile` and `UrsaProfileResponse` conforming to `PROJECT.md § Interface Contracts`.

### 1.2 Prohibited Patterns Scan Results
- **Hardcoded test results**: Searched for hardcoded student IDs (`1650...`), student names, test strings in `src/lib/ursa/profileParser.ts` and `src/app/api/profile/route.ts`. **Result: ZERO matches found in production code.**
- **Facade implementations**: Inspected function bodies for placeholder `return <constant>` or bypassed methods. **Result: Real DOM/regex parsing, entity decoding, session lookup, and fetch proxying are fully implemented.**
- **Fabricated verification outputs / pre-populated artifacts**: Scanned `.agents/` and workspace root for pre-existing log files or fake test outputs. **Result: No fabricated artifacts found.**
- **Authentication bypass / backdoors**: Inspected for bypass query parameters (`?mock=true`, `?bypass=1`), header overrides, or secret keys. **Result: Strict session validation required on all requests.**
- **Workspace layout**: Verified that `.agents/` contains only metadata (briefings, handoffs, progress). **Result: 100% compliant.**

---

## 2. Logic Chain

1. **Compliance with User Constraints (`ORIGINAL_REQUEST.md`)**:
   - Requirement R2 mandates fetching `/remark/remark.cfm`, decoding windows-874 HTML payload to UTF-8, extracting Student ID and Student Name, and returning structured JSON.
   - Both `profileParser.ts` and `route.ts` satisfy these requirements faithfully without shortcuts or mocks.

2. **Compliance with Interface Contracts (`PROJECT.md`)**:
   - Contract for `/api/profile`:
     - Request Cookie: `buplaner_session`
     - Response 200: `{ ok: true, studentId: string, studentName: string, meta?: string, faculty?: string, department?: string, html?: string }`
     - Error 401: `{ error: "Connect URSA first" }`
     - Error 502: `{ error: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" }`
     - Header: `Cache-Control: no-store, max-age=0`
   - Verified that `src/app/api/profile/route.ts` precisely matches all contract specifications.

3. **Mode-Agnostic vs Mode-Specific Flagging**:
   - Under **Development Mode**: No hardcoded test results, no facades, no fabricated outputs. -> **CLEAN**
   - Under **Demo Mode**: Built genuine parser and route handler; standard library and pure TS used; no prohibited external delegators. -> **CLEAN**
   - Under **Benchmark Mode**: Pure from-scratch TypeScript parser; zero external npm DOM libraries (no cheerio/jsdom). -> **CLEAN**

4. **Security & Robustness Assessment**:
   - ReDoS stress test: All regular expressions in `profileParser.ts` operate in linear time without nested quantifiers.
   - Malformed HTML resilience: Parser handles unclosed tags, noise tables, comment injections, script tags, empty tables, and entity strings gracefully without throwing.
   - Upstream SSRF guard: `fetchUrsa` targets `https://ursa2.bu.ac.th`, strictly bounded by `isAllowedUrsaHost`.

---

## 3. Caveats

- Upstream URSA server (`ursa2.bu.ac.th`) is an external Bangkok University ColdFusion host. In offline or mock test environments, network calls are intercepted by simulated fetch responses in the test runner.
- The parser expects student IDs to match standard Bangkok University 8–12 digit patterns (specifically BU 10-digit IDs starting with 1). For unconventional non-numeric IDs, extraction relies on adjacent table header cells.

---

## 4. Conclusion

The Milestone 2 work product (`src/lib/ursa/profileParser.ts`, `src/app/api/profile/route.ts`, and `src/types/ursa.ts`) implements genuine, robust, and secure student profile parsing and session-authenticated proxying without any hardcoded shortcuts, facades, or backdoors.

**VERDICT: CLEAN**

---

## 5. Verification Method

To independently verify this verdict:

1. **Source Inspection**:
   - Review `src/lib/ursa/profileParser.ts` lines 19–207 for entity cleaning, table isolation, adjacent cell matching, and fallback logic.
   - Review `src/app/api/profile/route.ts` lines 7–70 for session validation, `fetchUrsa` call, `decodeUrsaResponse`, and HTTP status code mappings.

2. **Automated Test Execution**:
   Run the test runner to execute the 21 automated unit, integration, and adversarial stress tests:
   ```powershell
   node --import tsx src/lib/ursa/__tests__/run_m2_challenger.ts
   ```
   Or:
   ```powershell
   npm test
   ```

3. **Invalidation Conditions**:
   - Presence of any hardcoded student ID/name in production routes.
   - Missing session verification on `/api/profile`.
   - Failure of parser on valid URSA Grade Report HTML.
