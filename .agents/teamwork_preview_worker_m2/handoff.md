# Handoff Report: Milestone 2 — Student Profile Fetcher

## 1. Observation

1. **Prerequisite & Contract Analysis**:
   - `PROJECT.md` Features 10–14 and `spec.md § 3` require fetching `/remark/remark.cfm` from URSA upstream (`https://ursa2.bu.ac.th`), decoding CP874/Windows-874 response buffers, parsing the student profile (Student ID, Name, Faculty, Department, Meta), and serving it through Next.js App Router GET `/api/profile`.
   - `src/lib/ursa/sessionStore.ts` provides `getSession(sessionId)` and `SESSION_COOKIE_NAME = 'buplaner_session'`.
   - `src/lib/ursa/decoder.ts` provides `decodeUrsaResponse(response)` to handle binary CP874 to UTF-8 decoding.
   - `src/lib/ursa/client.ts` provides `fetchUrsa(pathOrUrl, sessionCookie)` configured with proper User-Agent and timeout controls.

2. **Files Created & Modified**:
   - `src/lib/ursa/profileParser.ts` (NEW):
     - `cleanHtmlText(raw: string): string` strips tags, decodes named (`&nbsp;`, `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&#39;`) and numeric/hex entities (`&#x...;`, `&#...;`), and collapses whitespace.
     - `parseProfileHtml(html: string | null | undefined): ParsedProfile` tokenizes table cells and extracts `studentId`, `studentName`, `meta`, `faculty`, and `department`. Handles both English (`Student ID`, `Name`, `Faculty`, `Department`) and Thai (`รหัสนักศึกษา`, `ชื่อ-สกุล`, `คณะ`, `สาขาวิชา`) labels, adjacent cell pairs, single-cell combined formats, and regex fallbacks. Fallbacks gracefully to `{ studentId: '', studentName: '', meta: 'ข้อมูลจาก URSA' }` without throwing.
   - `src/app/api/profile/route.ts` (NEW):
     - Next.js App Router GET handler.
     - Validates `buplaner_session` cookie via `getSession()`, returning 401 `{ error: 'Connect URSA first' }` with `Cache-Control: no-store, max-age=0` if session is missing or expired.
     - Fetches `/remark/remark.cfm` via `fetchUrsa(..., session.cookie)`.
     - Decodes Windows-874 response via `decodeUrsaResponse(response)`.
     - Parses HTML payload via `parseProfileHtml(html)`.
     - Returns 200 OK JSON `{ ok: true, studentId, studentName, meta, faculty, department, html }` with `Cache-Control: no-store, max-age=0`.
     - Returns 502 Bad Gateway `{ error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' }` on upstream 5xx or network errors.
   - `src/types/ursa.ts` (MODIFIED):
     - Added optional `faculty?: string` and `department?: string` to `UrsaProfileResponse`.
   - `src/lib/ursa/__tests__/m2_profile.test.ts` (NEW):
     - 11 unit and route integration tests verifying entity decoding, standard/Thai table parsing, single-cell format, fallback safety, unauthenticated rejection, expired session rejection, successful profile fetch and decode, upstream 500 error handling, network error handling, and cache control headers.
   - `src/lib/ursa/__tests__/run_m2_challenger.ts` (NEW):
     - Test runner for Milestone 2 verification.
   - `package.json` (MODIFIED):
     - Added `"test": "node --import tsx src/lib/ursa/__tests__/run_m2_challenger.ts"`.

3. **Build Output**:
   Command `npm run build` executed successfully:
   ```
   ▲ Next.js 16.3.1 (Turbopack)
   ✓ Running next.config.ts took 44ms
   ✓ Compiled successfully in 688ms
   Running TypeScript ...
   Finished TypeScript in 1699ms ...
   Route (app)
   ┌ ○ /
   ├ ○ /_not-found
   ├ ƒ /api/auth/login
   ├ ƒ /api/auth/logout
   ├ ƒ /api/auth/status
   └ ƒ /api/profile
   ```

---

## 2. Logic Chain

1. **Authentication & Session Validation**:
   - The route handler reads the `buplaner_session` cookie from `request.cookies.get(SESSION_COOKIE_NAME)?.value`.
   - `getSession(sessionId)` checks that the session exists in the memory store and has not exceeded the 1-hour TTL (`SESSION_TTL_MS = 3600000`).
   - If invalid or missing, an immediate HTTP 401 response with `{ error: 'Connect URSA first' }` is returned, preventing unauthorized upstream proxy calls.

2. **Upstream Retrieval & Encoding Preservation**:
   - `fetchUrsa('/remark/remark.cfm', session.cookie)` sends the active URSA ColdFusion cookie to Bangkok University's server.
   - `decodeUrsaResponse(response)` reads the binary response buffer and applies `TextDecoder('windows-874')` (with UTF-8 and Latin-1 fallbacks), ensuring Thai characters like `"นุชนิชา"` are correctly decoded without mojibake.

3. **Resilient Server-Side DOM/Regex Parsing**:
   - `parseProfileHtml` does not depend on heavy client-side browser DOM or heavy external npm libraries.
   - It performs sanitization (stripping comments, scripts, styles), isolates the grade report table, cleans cell contents, and matches labels across both English and Thai nomenclatures.
   - It computes formatted `meta` (`"Student ID <id>"` or `"ข้อมูลจาก URSA"`).
   - If the student has no grade report or the page is empty, it returns empty strings and default meta rather than throwing or failing, allowing the frontend planner to operate without disruption.

4. **Response Protocol & Caching**:
   - The route returns structured JSON along with the raw decoded `html` payload for backward compatibility with `ScheduleBU`.
   - The `Cache-Control: no-store, max-age=0` header ensures fresh student data is always loaded and private session data is never cached by intermediaries or browsers.

---

## 3. Caveats

1. **Offline Upstream Mocking**: Upstream `https://ursa2.bu.ac.th` cannot be contacted directly in isolated or offline environments; integration tests mock `globalThis.fetch` to simulate authentic URSA responses.
2. **Fresh/Empty Student Records**: If a student is newly admitted or has no Grade Report generated yet, `parseProfileHtml` returns empty strings for `studentId` and `studentName` and `"ข้อมูลจาก URSA"` for `meta`. This is intentional and adheres to the non-blocking profile requirement.

---

## 4. Conclusion

Milestone 2 (Student Profile Fetcher) is fully implemented and conforms to all specifications:
- `src/lib/ursa/profileParser.ts` cleanly extracts student profile metadata with entity decoding, Thai character preservation, and resilient fallbacks.
- `src/app/api/profile/route.ts` implements secure session-protected GET handling with proper upstream proxying, error handling, and cache-control headers.
- Next.js production build (`npm run build`) completes cleanly with 0 TypeScript/Turbopack errors and registers `/api/profile`.

---

## 5. Verification Method

### 5.1 Next.js Build Verification
Run the build command to verify 0 TypeScript and compilation errors:
```powershell
npm run build
```
Expected output: Exit code 0, all routes including `ƒ /api/profile` compiled.

### 5.2 Code & Route Inspection
1. Inspect `src/lib/ursa/profileParser.ts` to verify DOM/Regex parsing rules, entity cleaning, and fallbacks.
2. Inspect `src/app/api/profile/route.ts` to verify session cookie extraction, 401 unauthenticated check, upstream fetch, decoding, and 502 error handling.
3. Inspect `src/types/ursa.ts` to verify `UrsaProfileResponse` schema.
