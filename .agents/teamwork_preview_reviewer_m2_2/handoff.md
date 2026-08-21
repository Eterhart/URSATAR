# Reviewer 2 Report: Milestone 2 — Student Profile Fetcher

## 1. Observation

A comprehensive code and architecture audit of Milestone 2 was conducted on the following files:
- `src/lib/ursa/profileParser.ts` (Lines 1–208)
- `src/app/api/profile/route.ts` (Lines 1–71)
- `src/types/ursa.ts` (Lines 1–89)
- `src/lib/ursa/sessionStore.ts` (Lines 1–67)
- `src/lib/ursa/client.ts` (Lines 1–182)
- `src/lib/ursa/decoder.ts` (Lines 1–27)
- `src/lib/ursa/__tests__/m2_profile.test.ts` (Lines 1–386)
- `src/lib/ursa/__tests__/run_m2_challenger.ts` (Lines 1–44)

### 1.1 Implementation Observations

1. **`src/lib/ursa/profileParser.ts`**:
   - **Entity Decoding & Sanitization** (Lines 19–33):
     `cleanHtmlText(raw: string)` strips HTML tags via `replace(/<[^>]+>/g, ' ')`, decodes standard named entities (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&apos;`), decodes hex entities `&#x([0-9a-fA-F]+);` via `String.fromCharCode(parseInt(hex, 16))`, and decodes decimal entities `&#(\d+);` via `String.fromCharCode(Number(code))`. Collapses consecutive whitespace characters.
   - **Scope Isolation & Multi-strategy Table Search** (Lines 51–74):
     Strips comments (`<!--...-->`), scripts, and style blocks. Isolates `<table>` blocks and locates the target Grade Report table matching `/Grade\s*Report/i`, `/Student\s*ID|รหัสนักศึกษา/i`, and `/\bName\b|ชื่อ/i`, with fallback to any table containing Student ID and Name markers.
   - **Cell Tokenization & Label-Value Matching** (Lines 76–154):
     Extracts cells via `/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi`. Iterates through cells to pair labels with values in adjacent cells (`i + 1`) or combined single cells for `Student ID`, `Student Name`, `Faculty`, and `Department` in both English and Thai (`รหัสนักศึกษา`, `ชื่อ-สกุล`, `คณะ`, `สาขาวิชา`, `ภาควิชา`).
   - **Fallback & Non-blocking Defaults** (Lines 156–206):
     Implements regex fallback (`buIdMatch` with pattern `\b(1\d{9})\b` and name/faculty extractors) when structured cell extraction fails. Returns `{ studentId: '', studentName: '', meta: 'ข้อมูลจาก URSA' }` if completely unparseable without throwing.

2. **`src/app/api/profile/route.ts`**:
   - **Session Verification & 401 Handling** (Lines 9–22):
     Reads `buplaner_session` cookie from request. Validates via `getSession(sessionId)`. If missing or expired (TTL > 3600s), immediately returns HTTP 401 with JSON `{ error: 'Connect URSA first' }` and `Cache-Control: no-store, max-age=0`.
   - **Upstream Proxy & 502 Handling** (Lines 24–36):
     Calls `fetchUrsa('/remark/remark.cfm', session.cookie)`. If upstream returns HTTP status >= 500, returns HTTP 502 with JSON `{ error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' }` and `Cache-Control: no-store, max-age=0`.
   - **Binary Decoding & Response Assembly** (Lines 38–57):
     Passes binary response buffer to `decodeUrsaResponse(response)` (which uses Windows-874 / CP874 TextDecoder with UTF-8 / Latin-1 fallbacks). Parses HTML with `parseProfileHtml(html)` and returns HTTP 200 with `{ ok: true, studentId, studentName, meta, faculty, department, html }`.
   - **Exception Safety** (Lines 58–69):
     Catches any thrown runtime/network exceptions, logs diagnostic error to console, and returns HTTP 502 with JSON `{ error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' }`.

3. **`src/types/ursa.ts`**:
   - Defines `UrsaProfile` and `UrsaProfileResponse` with full type coverage (`studentId`, `studentName`, `meta`, `faculty`, `department`, `html`, `error`).

4. **Integrity & Anti-Cheat Audit**:
   - No hardcoded student names or IDs in source code.
   - Logic implements genuine DOM tokenization and regex extraction rather than facades.
   - Upstream session cookies are kept server-side in the session store and not leaked to client responses.

---

## 2. Logic Chain

1. **Next.js App Router & Type Safety**:
   - Route handler conforms to Next.js 16+ conventions using standard `NextRequest`, `NextResponse`, and exported `GET` function.
   - All response payloads match the TypeScript contract in `src/types/ursa.ts`.

2. **Security & Session Hygiene**:
   - Authentication boundary: Only valid, non-expired sessions stored in `sessionStore.ts` can trigger upstream requests.
   - Upstream ColdFusion cookies (`CFID`, `CFTOKEN`) remain isolated on the server; the client receives only the opaque, cryptographically random `buplaner_session` token.
   - Private student data and auth responses explicitly disable caching via `Cache-Control: no-store, max-age=0`.

3. **Resilience & Non-blocking Guarantee**:
   - In accordance with Feature 14 of `PROJECT.md`, if the Grade Report page is missing or the student record is empty, `parseProfileHtml` safely defaults to empty profile strings and `meta: 'ข้อมูลจาก URSA'`. The route responds with HTTP 200 OK, preventing disruption to the timetable planner client.

4. **Error Differentiation**:
   - Auth failures (unconnected, invalid session, expired session) yield 401 with standard error message `'Connect URSA first'`.
   - Network timeouts, DNS failures, or upstream 5xx errors yield 502 with Thai message `'ไม่สามารถดึงข้อมูลโปรไฟล์ได้'`.

---

## 3. Caveats

1. **In-Memory Session Store**: The current session store is in-memory (`sessionMap`), suitable for single-instance / development setups. In a distributed multi-replica serverless deployment, a shared cache (e.g. Redis) would be required for horizontal scaling.
2. **Upstream ColdFusion Flakiness**: Upstream `https://ursa2.bu.ac.th` can be intermittent; the route handler's 502 catch-all and timeout handling properly isolate the Next.js frontend from upstream crashes.

---

## 4. Conclusion

Milestone 2 (Student Profile Fetcher) fulfills all specified requirements with high quality, rigorous type safety, secure session handling, robust Windows-874 decoding, resilient non-blocking HTML parsing, and comprehensive error categorization.

VERDICT: APPROVE

---

## 5. Verification Method

To independently verify the implementation:

1. **Verify Route and Parser Implementation**:
   - Inspect `src/app/api/profile/route.ts` for session cookie validation, 401 rejection, upstream proxying, and 502 handling.
   - Inspect `src/lib/ursa/profileParser.ts` for entity decoding, multi-table regex searching, Thai/English label matching, and fallback handling.

2. **Verify Type Definitions**:
   - Inspect `src/types/ursa.ts` lines 31–47 for `UrsaProfile` and `UrsaProfileResponse`.

3. **Run Test Suite & Build Verification**:
   - Run `npm test` or `node --import tsx src/lib/ursa/__tests__/run_m2_challenger.ts` (11/11 tests pass).
   - Run `npm run build` to confirm 0 TypeScript / Turbopack compilation errors.
