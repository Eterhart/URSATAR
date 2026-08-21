# Milestone 2: Student Profile Fetcher — Analysis & Implementation Strategy

## 1. Observation

### 1.1 Existing Codebase & Type Definitions
- **`src/types/ursa.ts` (lines 31–45)**:
  ```typescript
  export interface UrsaProfile {
    studentId: string;
    studentName: string;
    faculty?: string;
    department?: string;
  }

  export interface UrsaProfileResponse {
    ok: boolean;
    studentId?: string;
    studentName?: string;
    meta?: string;
    html?: string;
    error?: string;
  }
  ```
- **`src/lib/ursa/sessionStore.ts` (lines 4–66)**:
  - `SESSION_COOKIE_NAME = 'buplaner_session'`
  - `getSession(sessionId: string | null | undefined): UrsaSession | null` validates token and 1-hour TTL (`SESSION_TTL_MS = 3600000`).
- **`src/lib/ursa/decoder.ts` (lines 4–25)**:
  - `decodeWindows874(buffer: ArrayBuffer | Uint8Array): string` decodes CP874 Thai bytes into UTF-8.
  - `decodeUrsaResponse(response: Response): Promise<string>` reads `response.arrayBuffer()` and applies `decodeWindows874`.
- **`src/lib/ursa/client.ts` (lines 160–180)**:
  - `fetchUrsa(pathOrUrl: string, sessionCookie?: string, init: RequestInit = {}): Promise<Response>` dispatches authenticated HTTP requests to `https://ursa2.bu.ac.th` with standard User-Agent.

### 1.2 ScheduleBU Reference Implementation
- **`ScheduleBU/server.js` (line 53)**:
  ```javascript
  if (req.method === 'GET' && req.url === '/api/profile') {
    const active = session(req);
    if (!active) return send(res, 401, { error: 'Connect URSA first' });
    const response = await fetch(`${URSA}/remark/remark.cfm`, { headers: { cookie: active.cookie } });
    return send(res, response.ok ? 200 : 502, { html: await ursaText(response) });
  }
  ```
- **`ScheduleBU/app.js` (lines 58–60)**:
  ```javascript
  async function loadProfile() {
    try {
      const response = await fetch('/api/profile');
      if (!response.ok) return;
      const { html } = await response.json();
      const documentFromUrsa = new DOMParser().parseFromString(html, 'text/html');
      const report = [...documentFromUrsa.querySelectorAll('table')].find((table) =>
        /Grade Report/i.test(table.textContent) &&
        /Student\s*ID/i.test(table.textContent) &&
        /\bName\b/i.test(table.textContent)
      );
      if (!report) return;
      const cells = [...report.querySelectorAll('td,th')];
      const nameIndex = cells.findIndex((cell) => /^name$/i.test(cell.textContent.trim()));
      const idIndex = cells.findIndex((cell) => /^student\s*id$/i.test(cell.textContent.trim()));
      const name = cells[nameIndex + 1]?.textContent.replace(/\s+/g, ' ').trim();
      const studentId = cells[idIndex + 1]?.textContent.replace(/\s+/g, ' ').trim();
      if (name) {
        document.getElementById('studentName').textContent = name;
        document.getElementById('studentMeta').textContent = studentId ? `Student ID ${studentId}` : 'ข้อมูลจาก URSA';
      }
    } catch { /* Profile is optional and must not block planning. */ }
  }
  ```

### 1.3 Target Specification Requirements
From `spec.md § 3` and `PROJECT.md § Features 10–14`:
- **Feature 10**: Profile Page Fetcher (`/remark/remark.cfm`).
- **Feature 11**: Grade Report Table Extractor (`/Grade Report/i`, `/Student ID/i`, `/Name/i`).
- **Feature 12**: Student Name & ID Parsing (`studentName`, `studentId`, `faculty`, `department`).
- **Feature 13**: Profile API Endpoint (`/api/profile`).
- **Feature 14**: Non-blocking Profile Fallback (returns `{ ok: true, studentId: "", studentName: "" }` if table absent).

---

## 2. Logic Chain

1. **Protocol Flow**:
   ```
   Client (Browser) -> GET /api/profile with Cookie: buplaner_session=<token>
     -> Next.js Route Handler (src/app/api/profile/route.ts)
       -> Validates session in sessionStore.ts (401 if missing/expired)
       -> fetchUrsa('/remark/remark.cfm', session.cookie)
       -> Upstream response decoded with decodeUrsaResponse (CP874 -> UTF-8)
       -> parseProfileHtml(decodedHtml)
       -> Returns 200 JSON: { ok: true, studentId, studentName, meta, html }
   ```

2. **Server-Side HTML Parsing Rationale**:
   - `ScheduleBU` performed parsing on the client using browser `DOMParser`.
   - In Next.js App Router, the server should parse the HTML directly so that client components (React Server & Client Components) receive typed, ready-to-display JSON data (`studentId`, `studentName`, `meta`) without client-side DOM parsing overhead.
   - Returning both structured JSON fields and the raw `html` ensures 100% backward compatibility.

3. **Pure Regex / Tokenizer vs External DOM Libraries**:
   - The project avoids heavy native DOM dependencies (like `jsdom` or `cheerio` which are not in `package.json`).
   - A pure TypeScript HTML tokenizer and regex extraction engine is zero-dependency, edge-compatible, lightning-fast, and completely deterministic across Node.js and browser environments.

4. **Parsing Heuristics & Resiliency**:
   - **Step 1: Sanitize & Clean**: Remove scripts, styles, comments, decode common HTML entities (`&nbsp;`, `&amp;`, `&#\d+;`).
   - **Step 2: Table Isolation**: Locate table blocks containing `Grade Report` or (`Student ID` and `Name`).
   - **Step 3: Cell Scanning**: Tokenize `<td|th>` cells. Find header index for `Name` / `ชื่อ` / `ชื่อ-สกุล` and extract `cells[index + 1]`. Find header index for `Student ID` / `รหัสนักศึกษา` and extract `cells[index + 1]`.
   - **Step 4: Regex Fallbacks**: If table layout is non-standard (e.g. single cell `Student ID: 1650701234`), use pattern matching:
     - Student ID: `/(?:Student\s*ID|รหัสนักศึกษา|ID)\s*[:]?\s*([0-9]{8,12})/i` or `/\b(1[0-9]{9})\b/`
     - Student Name: `/(?:Name|ชื่อ-สกุล|ชื่อ)\s*[:]?\s*([^\r\n<>&;]{2,80})/i`
   - **Step 5: Whitespace & Diacritics**: Collapse all `\s+` to single spaces. Preserve all Thai Unicode characters (`\u0E00-\u0E7F`).

5. **Error & Status Mapping**:
   - Missing / Expired Session: `401 Unauthorized` with `{ error: "Connect URSA first" }`.
   - Upstream URSA HTTP 5xx / Network Timeout / DNS failure: `502 Bad Gateway` with `{ error: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" }`.
   - Upstream 200 OK but no Grade Report table: `200 OK` with `{ ok: true, studentId: "", studentName: "", meta: "ข้อมูลจาก URSA", html }`.

---

## 3. Caveats

1. **Upstream Network Isolation**: During automated testing and offline development, `https://ursa2.bu.ac.th` cannot be contacted directly. All automated tests must mock `globalThis.fetch` or use simulated HTML buffers.
2. **Thai Character Encoding**: Input to `parseProfileHtml` must already be decoded to UTF-8 (via `decodeWindows874` / `decodeUrsaResponse`). If raw CP874 bytes are passed directly as Latin1 string without decoding, Thai characters will be mojibake.
3. **Empty Term / Fresh Accounts**: Freshman students or newly enrolled accounts may have an empty Grade Report. The parser must never throw an uncaught exception on empty or malformed HTML; it must return default empty fields.

---

## 4. Conclusion & Proposed Code Implementation

### 4.1 Module 1: `src/lib/ursa/profileParser.ts`
Create `src/lib/ursa/profileParser.ts` with the following implementation:

```typescript
/**
 * Bangkok University URSA Student Profile Parser
 * 
 * Extracts student profile metadata (Student ID, Name, Faculty, Department)
 * from URSA Grade Report HTML (/remark/remark.cfm).
 */

export interface ParsedProfile {
  studentId: string;
  studentName: string;
  meta: string;
  faculty?: string;
  department?: string;
}

/**
 * Strips HTML tags and decodes common HTML entities.
 */
function cleanHtmlText(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Pure DOM / Regex parser for URSA Grade Report HTML (/remark/remark.cfm).
 * 
 * Works in both Node.js (SSR / API Routes) and Browser environments.
 */
export function parseProfileHtml(html: string | null | undefined): ParsedProfile {
  const result: ParsedProfile = {
    studentId: '',
    studentName: '',
    meta: 'ข้อมูลจาก URSA',
  };

  if (!html || typeof html !== 'string' || !html.trim()) {
    return result;
  }

  // Normalize HTML
  const sanitizedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // 1. Locate Grade Report Table
  const tableMatches = sanitizedHtml.match(/<table\b[^>]*>([\s\S]*?)<\/table>/gi) || [];
  let targetTableHtml = tableMatches.find((table) =>
    /Grade\s*Report/i.test(table) &&
    /Student\s*ID|รหัสนักศึกษา/i.test(table) &&
    /\bName\b|ชื่อ/i.test(table)
  );

  // If specific Grade Report table not found, search in any table containing Student ID and Name
  if (!targetTableHtml) {
    targetTableHtml = tableMatches.find((table) =>
      /Student\s*ID|รหัสนักศึกษา/i.test(table) &&
      /\bName\b|ชื่อ/i.test(table)
    );
  }

  const searchScope = targetTableHtml || sanitizedHtml;

  // 2. Extract Cells from Scope
  const cellRegex = /<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi;
  const cells: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = cellRegex.exec(searchScope)) !== null) {
    cells.push(cleanHtmlText(match[1]));
  }

  // 3. Scan Adjacent Cells for ID, Name, Faculty, Department
  if (cells.length > 0) {
    for (let i = 0; i < cells.length; i++) {
      const cellText = cells[i].trim();

      // Student ID
      if (/^(?:Student\s*ID|รหัสนักศึกษา|ID)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.studentId) {
          result.studentId = val;
        }
      }

      // Student Name
      if (/^(?:Name|ชื่อ-สกุล|ชื่อ|Student\s*Name)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.studentName) {
          result.studentName = val;
        }
      }

      // Faculty
      if (/^(?:Faculty|คณะ)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.faculty) {
          result.faculty = val;
        }
      }

      // Department
      if (/^(?:Department|สาขาวิชา|ภาควิชา)\s*:?$/i.test(cellText) && i + 1 < cells.length) {
        const val = cells[i + 1].replace(/^[:\s-]+/, '').trim();
        if (val && !result.department) {
          result.department = val;
        }
      }
    }
  }

  // 4. Regex Fallback if adjacent cells were not separated
  if (!result.studentId) {
    const idMatch = searchScope.match(/(?:Student\s*ID|รหัสนักศึกษา)[\s:]*([0-9]{8,12})/i);
    if (idMatch && idMatch[1]) {
      result.studentId = idMatch[1].trim();
    } else {
      const buIdMatch = searchScope.match(/\b(1\d{9})\b/);
      if (buIdMatch && buIdMatch[1]) {
        result.studentId = buIdMatch[1].trim();
      }
    }
  }

  if (!result.studentName) {
    const nameMatch = searchScope.match(/(?:Name|ชื่อ-สกุล|ชื่อ)[\s:]*([^\r\n<>&;]{2,80})/i);
    if (nameMatch && nameMatch[1]) {
      const clean = cleanHtmlText(nameMatch[1]).replace(/^[:\s-]+/, '').trim();
      if (clean && !/^(?:Student\s*ID|Faculty|Department)/i.test(clean)) {
        result.studentName = clean;
      }
    }
  }

  // 5. Compute Display Meta
  if (result.studentId) {
    result.meta = `Student ID ${result.studentId}`;
  } else {
    result.meta = 'ข้อมูลจาก URSA';
  }

  return result;
}
```

### 4.2 Module 2: `src/app/api/profile/route.ts`
Create `src/app/api/profile/route.ts` with the following implementation:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { fetchUrsa } from '@/lib/ursa/client';
import { decodeUrsaResponse } from '@/lib/ursa/decoder';
import { parseProfileHtml } from '@/lib/ursa/profileParser';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
    const session = getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Connect URSA first' },
        {
          status: 401,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const response = await fetchUrsa('/remark/remark.cfm', session.cookie);

    if (!response.ok && response.status >= 500) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' },
        { status: 502 }
      );
    }

    const html = await decodeUrsaResponse(response);
    const parsed = parseProfileHtml(html);

    return NextResponse.json(
      {
        ok: true,
        studentId: parsed.studentId,
        studentName: parsed.studentName,
        meta: parsed.meta,
        faculty: parsed.faculty,
        department: parsed.department,
        html,
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[URSA Profile Route Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูลโปรไฟล์ได้' },
      { status: 502 }
    );
  }
}
```

---

## 5. Verification Method

### 5.1 Test Scenarios for Milestone 2 Test Suite (`src/lib/ursa/__tests__/m2_profile.test.ts`)
1. **`parseProfileHtml` Unit Tests**:
   - **Standard Table Layout**: HTML with `Grade Report`, `Student ID : 1650701234`, `Name : นางสาว นุชนิชา รุ่งโรจน์`.
   - **Thai Labels Layout**: HTML with `รหัสนักศึกษา : 1650709999`, `ชื่อ-สกุล : นาย สมชาย ใจดี`.
   - **Single Cell Combined Key/Value**: `<td>Student ID: 1650705555</td><td>Name: John Smith</td>`.
   - **Whitespace & Newline Noise**: HTML with tabs, multiple spaces, and `&nbsp;`.
   - **Missing Grade Report Table**: Gracefully returns `{ ok: true, studentId: "", studentName: "", meta: "ข้อมูลจาก URSA" }`.
   - **Empty / Null / Corrupted String**: Returns default empty profile without throwing.
2. **`GET /api/profile` Route Handler Tests**:
   - **Unauthenticated (No Cookie)**: Returns `401 Unauthorized` with `{ error: "Connect URSA first" }`.
   - **Expired Session**: Returns `401 Unauthorized` with `{ error: "Connect URSA first" }`.
   - **Authenticated Success**: Mocks upstream fetch returning Grade Report HTML, returns `200 OK` with `{ ok: true, studentId, studentName, meta, html }`.
   - **Upstream 500 / Network Error**: Returns `502 Bad Gateway` with `{ error: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" }`.
   - **Cache-Control Header**: Verifies `no-store, max-age=0` header is present.

### 5.2 Test Runner Command
When ready, the test suite can be run via:
```powershell
npx tsx src/lib/ursa/__tests__/run_m2_challenger.ts
```
All assertions should pass with 100% success rate.
