# Handoff Report: Milestone 3 — Dynamic Course & Section Query Architecture

**Author**: Explorer Agent (Milestone 3)  
**Target Modules**:
- `src/lib/ursa/sectionParser.ts`
- `src/app/api/sections/route.ts`
- `src/app/api/sections/query/route.ts`
- `src/lib/ursa/__tests__/m3_sections.test.ts`  
**Date**: 2026-08-21T04:12:45+07:00  
**Handoff Type**: Hard (Investigation Complete & Implementation Ready)

---

## 1. Observation

Direct code and architectural observations gathered from the reference implementation (`ScheduleBU`), existing codebase (`quick-chandrasekhar`), and project specifications:

### 1.1 Reference Architecture in `ScheduleBU`
- **Form Metadata Endpoint (`server.js:43`)**:
  ```javascript
  if (req.method === 'GET' && req.url.startsWith('/api/sections')) {
    const active = session(req);
    if (!active) return send(res, 401, { error: 'Connect URSA first' });
    const response = await fetch(`${URSA}/seat/seat1.cfm`, { headers: { cookie: active.cookie } });
    return send(res, response.ok ? 200 : 502, { html: await ursaText(response) });
  }
  ```
- **Section Query Endpoint & SSRF Protection (`server.js:44-52`)**:
  ```javascript
  if (req.method === 'POST' && req.url === '/api/sections/query') {
    const active = session(req);
    if (!active) return send(res, 401, { error: 'Connect URSA first' });
    const { action, method = 'GET', fields = {} } = await json(req);
    const target = new URL(action || 'seat1.cfm', `${URSA}/seat/seat1.cfm`);
    if (target.origin !== URSA || !target.pathname.startsWith('/seat/'))
      return send(res, 400, { error: 'Invalid URSA form target' });
    const options = { method: method.toUpperCase(), headers: { cookie: active.cookie, referer: `${URSA}/seat/seat1.cfm` } };
    if (options.method === 'GET') { Object.entries(fields).forEach(([key, value]) => target.searchParams.set(key, value)); }
    else { options.headers['content-type'] = 'application/x-www-form-urlencoded'; options.body = new URLSearchParams(fields); }
    const response = await fetch(target, options);
    return send(res, response.ok ? 200 : 502, { html: await ursaText(response) });
  }
  ```
- **Client-Side Form Discovery Heuristic (`app.js:30-33`)**:
  ```javascript
  function readUrsaForm(html) {
    const documentFromUrsa = new DOMParser().parseFromString(html, 'text/html');
    return [...documentFromUrsa.forms].map((form) => ({
      action: form.getAttribute('action') || 'seat1.cfm',
      method: form.getAttribute('method') || 'GET',
      controls: [...form.elements].filter((item) => item.name && !['submit', 'button', 'password', 'radio'].includes(item.type)).map((item) => ({
        name: item.name,
        type: item.tagName === 'SELECT' ? 'select' : item.type,
        value: item.value,
        options: item.tagName === 'SELECT' ? [...item.options].map((option) => ({ value: option.value, text: option.text })) : []
      }))
    })).find((form) => form.controls.some((control) => /year|term|course|section|acd|sem/i.test(control.name)));
  }
  ```
- **Section Results Table Extraction Heuristic (`app.js:51-53`)**:
  ```javascript
  const sourceTable = [...documentFromUrsa.querySelectorAll('table')].find(
    (table) => /Seat\(s\)/i.test(table.textContent) && /Status/i.test(table.textContent) && table.querySelectorAll('tr').length > 3
  );
  const course = sourceTable.textContent.match(/\b[A-Z]{2,4}\d{3}\b/)?.[0] || 'รายวิชา';
  ```

### 1.2 Existing Type Definitions in `src/types/`
- `src/types/schedule.ts`:
  - `DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT'`
  - `Section`: `{ sectionNo, day, startTime, endTime, room, instructor, campus, totalSeats, availableSeats, midtermDate?, finalDate? }`
  - `Course`: `{ id, code, nameTh, nameEn, credits, category, faculty, description, prerequisite?, color, sections: Section[] }`
- `src/types/ursa.ts`:
  - `UrsaFormControlOption`: `{ value: string, text: string }`
  - `UrsaFormControl`: `{ name: string, type: string, value?: string, options?: UrsaFormControlOption[] }`
  - `UrsaForm`: `{ action: string, method: string, controls: UrsaFormControl[] }`
  - `UrsaSectionsResponse`: `{ ok: boolean, form?: UrsaForm, html?: string, error?: string }`
  - `UrsaQueryRequest`: `{ academicYear?, semester?, courseCodes?, action?, method?, fields? }`
  - `UrsaQueryResponse`: `{ ok: boolean, courses?: Course[], html?: string, error?: string }`

### 1.3 Existing URSA Library Utilities
- `src/lib/ursa/sessionStore.ts`:
  - `getSession(sessionId)` retrieves active `UrsaSession` (`{ cookie, createdAt }`) or null if expired (> 3600s).
  - `SESSION_COOKIE_NAME = 'buplaner_session'`
- `src/lib/ursa/decoder.ts`:
  - `decodeWindows874(buffer: ArrayBuffer | Uint8Array): string`
  - `decodeUrsaResponse(response: Response): Promise<string>`
- `src/lib/ursa/client.ts`:
  - `URSA_BASE_URL = 'https://ursa2.bu.ac.th'`
  - `isAllowedUrsaHost(hostname: string): boolean`
  - `fetchUrsa(pathOrUrl: string, sessionCookie?: string, init?: RequestInit): Promise<Response>`

### 1.4 URSA Section Table Column Schema (`UrsaSectionTable.tsx:53-64` & `spec.md § 4.3`)
| Column Index | Column Header | Data Field | Example Value / Rule |
|:---:|:---|:---|:---|
| 0 | `Section` | `sectionNo` | `"3271"` |
| 1 | `Seat(s)` | `availableSeats` / `totalSeats` | `"12 / 40"` -> `12`, `40` |
| 2 | `Status` | `status` | `"On"`, `"Close"`, `"Freeze"` |
| 3 | `Type` | `type` | `"LECT"`, `"LAB"`, `"PRAC"` |
| 4 | `Day` | `day` | `"Mon"`, `"จันทร์"`, `"MO"` -> `'MON'` |
| 5 | `Time` | `startTime`, `endTime` | `"09:00 - 12:00"` -> `"09:00"`, `"12:00"` |
| 6 | `Room` | `room` | `"RB4605"`, `"Diamond Lab 4"` |
| 7 | `Remark2` | `instructor` | `"ดร. กฤษฎา ภาคภูมิ"` |
| 8 | `Remark1` | `remark1` | `"-"` |
| 9 | `Examination` | `midtermDate`, `finalDate` | `"14 ต.ค. 2567 (09:00 - 12:00)"` |
| 10 | `Restriction` | `restriction` | `"- R All All TP Both"` |

---

## 2. Logic Chain

From the observations above, the following end-to-end design decisions and processing pipelines are established:

```
┌────────────────────────────────────────────────────────────────────────┐
│ Client Request                                                         │
│ - GET  /api/sections                                                   │
│ - POST /api/sections/query (Raw Form Proxy OR Multi-Course Array)      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Validate buplaner_session Cookie
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Auth & Security Guard                                                  │
│ 1. getSession(sessionId) -> 401 Unauthorized if missing/expired        │
│ 2. SSRF Check: isAllowedUrsaHost(target.hostname) && /seat/ path       │
│    -> 400 Bad Request if host/path not whitelisted                     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Forward with Active URSA Cookies
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Upstream URSA Communication (https://ursa2.bu.ac.th/seat/seat1.cfm)    │
│ - GET: Query parameters appended to URL                                │
│ - POST: x-www-form-urlencoded body                                     │
│ - Multi-Course: Parallel/Sequential queries for each Course Code       │
│ - Upstream 5xx / Network Error -> 502 Bad Gateway                      │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Binary Response Buffer
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Decoding Pipeline (decodeUrsaResponse)                                 │
│ - windows-874 TextDecoder -> Clean UTF-8 String                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Decoded HTML String
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ Pure DOM / Regex Parsing Engine (src/lib/ursa/sectionParser.ts)        │
│                                                                        │
│ 1. Form Discovery (parseUrsaForm):                                     │
│    - Extracts <select> (acdyr, sem, option1) + <input> (course_code)   │
│    - Extracts options with selected values                             │
│                                                                        │
│ 2. Table Extractor (parseSectionsHtml):                                │
│    - Filters tables matching /Seat\(s\)|ที่นั่ง/i & /Status|สถานะ/i     │
│    - Extracts Course Code (/\b[A-Z]{2,4}\d{3}\b/) or fallbackCode      │
│    - Iterates over <tr> rows, discarding header rows                   │
│    - Normalizes Day ('Mon'/'จันทร์'/'MO' -> 'MON')                     │
│    - Normalizes Time ('09.00 - 12.00' -> '09:00', '12:00')             │
│    - Normalizes Seats ('12 / 40' -> 12, 40)                            │
│    - Classifies Type ('LAB' if room contains 'lab' or type is 'LAB')   │
│    - Enriches Course with Mock / Dynamic category, color, metadata     │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ Structured JSON Output
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│ HTTP Response (200 OK + Cache-Control: no-store, max-age=0)           │
│ - GET  /api/sections       -> { ok: true, form, html }                 │
│ - POST /api/sections/query -> { ok: true, courses: Course[], html }    │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1 Day and Time Normalization Mapping
1. **Day Normalization**:
   - `MON`: `"mon"`, `"monday"`, `"จันทร์"`, `"วันจันทร์"`, `"จ."`, `"จ"`, `"mo"`, `"m"`
   - `TUE`: `"tue"`, `"tuesday"`, `"อังคาร"`, `"วันอังคาร"`, `"อ."`, `"อ"`, `"tu"`, `"t"`
   - `WED`: `"wed"`, `"wednesday"`, `"พุธ"`, `"วันพุธ"`, `"พ."`, `"พ"`, `"we"`, `"w"`
   - `THU`: `"thu"`, `"thursday"`, `"พฤหัส"`, `"พฤหัสบดี"`, `"วันพฤหัสบดี"`, `"พฤ."`, `"พฤ"`, `"th"`
   - `FRI`: `"fri"`, `"friday"`, `"ศุกร์"`, `"วันศุกร์"`, `"ศ."`, `"ศ"`, `"fr"`, `"f"`
   - `SAT`: `"sat"`, `"saturday"`, `"เสาร์"`, `"วันเสาร์"`, `"ส."`, `"ส"`, `"sa"`, `"s"`

2. **Time Parsing**:
   - Pattern: `/(\d{1,2})[.:](\d{2})\s*(?:-|–|to)\s*(\d{1,2})[.:](\d{2})/i`
   - Formats matched: `09:00 - 12:00`, `09.00 - 12.00`, `9:00 - 12:00`, `13:30-16:30`
   - Output: `startTime: "09:00"`, `endTime: "12:00"` (two-digit zero padded).

3. **Seat Availability**:
   - Match: `/(\d+)\s*\/\s*(\d+)/` -> `availableSeats = parseInt(m[1])`, `totalSeats = parseInt(m[2])`
   - Single Number Match: `totalSeats = parseInt(m[0])`, `availableSeats = status === 'Close' || /เต็ม/i.test(cell) ? 0 : totalSeats`

4. **Category & Color Assignment for Courses**:
   - If course exists in `MOCK_COURSES`, enrich with predefined metadata (Thai/En name, credits, category, faculty, color).
   - If novel course code, derive deterministic pleasant palette color via string hash and assign default `IT_COMPUTING` / `Bangkok University`.

---

## 3. Caveats

1. **Node.js Environment Without DOMParser**:
   - Next.js server route handlers run in a Node.js / Serverless runtime where browser `window.DOMParser` is undefined.
   - `sectionParser.ts` must use pure regex / string tokenization (just like `profileParser.ts`) so it executes identically in Node.js route handlers, unit test runners, and client browser environments without requiring heavy external dependencies like `jsdom`.
2. **Upstream Multi-Course Query Concurrency**:
   - When querying an array of course codes (e.g. 6 courses), executing queries concurrently with `Promise.all` is fast, but must handle partial failures gracefully (e.g. if one course has 0 sections, the other 5 should still succeed).
3. **Malformed Table Rows in ColdFusion Output**:
   - ColdFusion occasionally outputs extra spacer rows (`<tr><td colspan="..."></td></tr>`) or subheadings. The parser must discard rows that don't have at least a valid numeric or alphanumeric section number.

---

## 4. Conclusion & Concrete Implementation Blueprints

The following complete TypeScript implementations are ready for deployment into the codebase:

### 4.1 `src/lib/ursa/sectionParser.ts`

```typescript
/**
 * Bangkok University URSA Section Table & Form Parser
 *
 * Pure DOM / Regex parser for URSA Section Availability (/seat/seat1.cfm).
 * Works in both Node.js (SSR / API Routes) and Browser environments without external dependencies.
 */

import { Course, Section, DayOfWeek } from '@/types/schedule';
import { UrsaForm, UrsaFormControl, UrsaFormControlOption } from '@/types/ursa';
import { MOCK_COURSES } from '@/data/mockCourses';

/**
 * Strips HTML tags and decodes common HTML entities.
 */
export function cleanHtmlText(raw: string | null | undefined): string {
  if (!raw) return '';
  return raw
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Normalizes day string (Thai or English) to standard DayOfWeek enum.
 */
export function normalizeDayOfWeek(rawDay: string | null | undefined): DayOfWeek | null {
  if (!rawDay) return null;
  const clean = cleanHtmlText(rawDay).toLowerCase().replace(/[\s.]/g, '');

  if (/^(?:mon|monday|จันทร์|วันจันทร์|จ|mo|m)$/i.test(clean)) return 'MON';
  if (/^(?:tue|tuesday|อังคาร|วันอังคาร|อ|tu|t)$/i.test(clean)) return 'TUE';
  if (/^(?:wed|wednesday|พุธ|วันพุธ|พ|we|w)$/i.test(clean)) return 'WED';
  if (/^(?:thu|thursday|พฤหัส|พฤหัสบดี|วันพฤหัส|วันพฤหัสบดี|พฤ|th)$/i.test(clean)) return 'THU';
  if (/^(?:fri|friday|ศุกร์|วันศุกร์|ศ|fr|f)$/i.test(clean)) return 'FRI';
  if (/^(?:sat|saturday|เสาร์|วันเสาร์|ส|sa|s)$/i.test(clean)) return 'SAT';

  // Substring checks for noisy Thai text
  if (clean.includes('จันทร์')) return 'MON';
  if (clean.includes('อังคาร')) return 'TUE';
  if (clean.includes('พุธ')) return 'WED';
  if (clean.includes('พฤหัส')) return 'THU';
  if (clean.includes('ศุกร์')) return 'FRI';
  if (clean.includes('เสาร์')) return 'SAT';

  return null;
}

/**
 * Parses start and end time from text (e.g. "09:00 - 12:00", "09.00 - 12.00", "13:30-16:30").
 */
export function parseTimeRange(rawTime: string | null | undefined): { startTime: string; endTime: string } | null {
  if (!rawTime) return null;
  const clean = cleanHtmlText(rawTime);
  const match = clean.match(/(\d{1,2})[.:](\d{2})\s*(?:-|–|to)\s*(\d{1,2})[.:](\d{2})/i);
  if (!match) return null;

  const startHour = match[1].padStart(2, '0');
  const startMin = match[2];
  const endHour = match[3].padStart(2, '0');
  const endMin = match[4];

  return {
    startTime: `${startHour}:${startMin}`,
    endTime: `${endHour}:${endMin}`,
  };
}

/**
 * Parses available seats and total seats from cell text (e.g. "12 / 40", "0 / 35", "40", "เต็ม").
 */
export function parseSeatCount(rawSeats: string | null | undefined, isClosed: boolean = false): { availableSeats: number; totalSeats: number } {
  if (!rawSeats) return { availableSeats: 0, totalSeats: 0 };
  const clean = cleanHtmlText(rawSeats);

  const ratioMatch = clean.match(/(\d+)\s*\/\s*(\d+)/);
  if (ratioMatch) {
    const available = Math.max(0, parseInt(ratioMatch[1], 10) || 0);
    const total = Math.max(0, parseInt(ratioMatch[2], 10) || 0);
    return { availableSeats: available, totalSeats: total };
  }

  const singleNumMatch = clean.match(/\b\d+\b/);
  if (singleNumMatch) {
    const num = Math.max(0, parseInt(singleNumMatch[0], 10) || 0);
    if (isClosed || /เต็ม|close|full/i.test(clean)) {
      return { availableSeats: 0, totalSeats: num };
    }
    return { availableSeats: num, totalSeats: num };
  }

  return { availableSeats: 0, totalSeats: 0 };
}

/**
 * Parses examination column for midterm and final dates.
 */
export function parseExamDates(rawExam: string | null | undefined): { midtermDate?: string; finalDate?: string } {
  if (!rawExam) return {};
  const clean = cleanHtmlText(rawExam);
  if (!clean || clean === '-') return {};

  const parts = clean.split(/\s*[\/\n]\s*/).map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) {
    return {
      midtermDate: parts[0],
      finalDate: parts[1],
    };
  }

  if (parts.length === 1) {
    if (/midterm|กลางภาค/i.test(parts[0])) {
      return { midtermDate: parts[0] };
    }
    if (/final|ปลายภาค/i.test(parts[0])) {
      return { finalDate: parts[0] };
    }
    return { midtermDate: parts[0] };
  }

  return {};
}

/**
 * Palette colors for novel / unknown courses.
 */
const COURSE_PALETTES = [
  '#2563EB', // Blue
  '#0D9488', // Teal
  '#7C3AED', // Violet
  '#0284C7', // Sky Blue
  '#EA580C', // Orange
  '#059669', // Emerald Green
  '#D97706', // Amber
  '#DB2777', // Pink
  '#4F46E5', // Indigo
];

function getCourseColor(code: string): string {
  let hash = 0;
  for (let i = 0; i < code.length; i++) {
    hash = code.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COURSE_PALETTES.length;
  return COURSE_PALETTES[index];
}

/**
 * Parses form controls from URSA /seat/seat1.cfm HTML.
 */
export function parseUrsaForm(html: string | null | undefined): UrsaForm | null {
  if (!html || typeof html !== 'string' || !html.trim()) return null;

  const formMatches = html.match(/<form\b[^>]*>([\s\S]*?)<\/form>/gi) || [];

  for (const formHtml of formMatches) {
    const actionMatch = formHtml.match(/action=["']?([^"'>\s]+)/i);
    const methodMatch = formHtml.match(/method=["']?([^"'>\s]+)/i);

    const action = actionMatch ? actionMatch[1] : 'seat1.cfm';
    const method = methodMatch ? methodMatch[1].toUpperCase() : 'GET';

    const controls: UrsaFormControl[] = [];

    // Extract <select> elements
    const selectRegex = /<select\b[^>]*name=["']?([^"'>\s]+)[^>]*>([\s\S]*?)<\/select>/gi;
    let selectMatch: RegExpExecArray | null;

    while ((selectMatch = selectRegex.exec(formHtml)) !== null) {
      const name = selectMatch[1];
      const selectInner = selectMatch[2];
      const options: UrsaFormControlOption[] = [];
      let selectedValue = '';

      const optionRegex = /<option\b([^>]*)>([\s\S]*?)<\/option>/gi;
      let optMatch: RegExpExecArray | null;

      while ((optMatch = optionRegex.exec(selectInner)) !== null) {
        const optAttrs = optMatch[1];
        const optText = cleanHtmlText(optMatch[2]);
        const valMatch = optAttrs.match(/value=["']?([^"'>\s]*)/i);
        const optValue = valMatch ? valMatch[1] : optText;

        options.push({ value: optValue, text: optText });

        if (/selected/i.test(optAttrs) || (!selectedValue && options.length === 1)) {
          selectedValue = optValue;
        }
      }

      controls.push({
        name,
        type: 'select',
        value: selectedValue,
        options,
      });
    }

    // Extract <input> elements
    const inputRegex = /<input\b([^>]*)>/gi;
    let inputMatch: RegExpExecArray | null;

    while ((inputMatch = inputRegex.exec(formHtml)) !== null) {
      const attrs = inputMatch[1];
      const nameMatch = attrs.match(/name=["']?([^"'>\s]+)/i);
      if (!nameMatch) continue;

      const name = nameMatch[1];
      const typeMatch = attrs.match(/type=["']?([^"'>\s]+)/i);
      const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';

      if (['submit', 'button', 'password', 'radio'].includes(type)) {
        continue;
      }

      const valMatch = attrs.match(/value=["']?([^"'>]*)/i);
      const value = valMatch ? valMatch[1] : '';

      controls.push({
        name,
        type,
        value,
      });
    }

    if (controls.some((c) => /year|term|course|section|acd|sem|option/i.test(c.name))) {
      return {
        action,
        method,
        controls,
      };
    }
  }

  return null;
}

/**
 * Pure DOM / Regex parser for URSA Section HTML table (/seat/seat1.cfm).
 */
export function parseSectionsHtml(
  html: string | null | undefined,
  fallbackCourseCode?: string
): Course[] {
  if (!html || typeof html !== 'string' || !html.trim()) {
    return [];
  }

  const sanitizedHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  const tableMatches = sanitizedHtml.match(/<table\b[^>]*>([\s\S]*?)<\/table>/gi) || [];

  // Find all candidate section tables
  const targetTables = tableMatches.filter((table) =>
    /Seat\(s\)|ที่นั่ง/i.test(table) &&
    /Status|สถานะ|Section|ตอนเรียน|กลุ่ม/i.test(table)
  );

  if (targetTables.length === 0 && tableMatches.length > 0) {
    // Check any table with at least 3 rows containing section-like digits
    const heuristicTable = tableMatches.find((t) => (t.match(/<tr\b/gi) || []).length >= 3 && /\b\d{4}\b/.test(t));
    if (heuristicTable) targetTables.push(heuristicTable);
  }

  const courseMap = new Map<string, Course>();

  for (const tableHtml of targetTables) {
    // 1. Detect Course Code from table header, caption, or fallback
    let detectedCode = fallbackCourseCode?.trim().toUpperCase() || '';

    const codeMatch = tableHtml.match(/\b([A-Z]{2,4}\s*\d{3})\b/i) || sanitizedHtml.match(/\b([A-Z]{2,4}\s*\d{3})\b/i);
    if (codeMatch && codeMatch[1]) {
      detectedCode = codeMatch[1].replace(/\s+/g, '').toUpperCase();
    }

    if (!detectedCode) {
      detectedCode = 'COURSE';
    }

    // 2. Lookup existing metadata from MOCK_COURSES if available
    const knownCourse = MOCK_COURSES.find((c) => c.code.toUpperCase() === detectedCode.toUpperCase());

    if (!courseMap.has(detectedCode)) {
      courseMap.set(detectedCode, {
        id: detectedCode.toLowerCase(),
        code: detectedCode,
        nameTh: knownCourse?.nameTh || detectedCode,
        nameEn: knownCourse?.nameEn || detectedCode,
        credits: knownCourse?.credits || 3,
        category: knownCourse?.category || 'IT_COMPUTING',
        faculty: knownCourse?.faculty || 'คณะเทคโนโลยีสารสนเทศและนวัตกรรม',
        description: knownCourse?.description || '',
        prerequisite: knownCourse?.prerequisite,
        color: knownCourse?.color || getCourseColor(detectedCode),
        sections: [],
      });
    }

    const course = courseMap.get(detectedCode)!;

    // 3. Parse Table Rows
    const rowMatches = tableHtml.match(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi) || [];

    for (const rowHtml of rowMatches) {
      // Discard header rows
      if (/<th\b/i.test(rowHtml) && !/<td\b/i.test(rowHtml)) continue;
      if (/Section|Seat\(s\)|Status|ประเภท/i.test(rowHtml) && /Day|Time|เวลา/i.test(rowHtml)) continue;

      const cellMatches = rowHtml.match(/<t[hd]\b[^>]*>([\s\S]*?)<\/t[hd]>/gi) || [];
      if (cellMatches.length < 3) continue;

      const cells = cellMatches.map((c) => cleanHtmlText(c));

      // Map columns:
      // Standard URSA order: [0:Section, 1:Seats, 2:Status, 3:Type, 4:Day, 5:Time, 6:Room, 7:Remark2/Instructor, 8:Remark1, 9:Examination, 10:Restriction]
      const sectionNo = cells[0]?.replace(/\D/g, '') || cells[0] || '';
      if (!sectionNo || sectionNo.length < 2) continue; // Skip invalid rows

      const rawSeats = cells[1] || '';
      const rawStatus = cells[2] || 'On';
      const isClosed = /close|ปิด|freeze/i.test(rawStatus);
      const seats = parseSeatCount(rawSeats, isClosed);

      const rawType = cells[3] || 'LECT';
      const rawDay = cells[4] || 'MON';
      const rawTime = cells[5] || '09:00 - 12:00';
      const room = cells[6] || 'TBA';
      const instructor = cells[7] || '-';
      const rawExam = cells[9] || '';

      const normalizedDay = normalizeDayOfWeek(rawDay) || 'MON';
      const timeParsed = parseTimeRange(rawTime) || { startTime: '09:00', endTime: '12:00' };
      const examDates = parseExamDates(rawExam);

      const isLab = /lab/i.test(room) || /lab/i.test(rawType);

      const section: Section = {
        sectionNo,
        day: normalizedDay,
        startTime: timeParsed.startTime,
        endTime: timeParsed.endTime,
        room: room || 'TBA',
        instructor: instructor && instructor !== '-' ? instructor : 'อาจารย์ผู้สอน',
        campus: /City|กล้วยน้ำไท/i.test(room) ? 'City Campus (กล้วยน้ำไท)' : 'Main Campus (รังสิต)',
        totalSeats: seats.totalSeats,
        availableSeats: seats.availableSeats,
        ...(examDates.midtermDate ? { midtermDate: examDates.midtermDate } : {}),
        ...(examDates.finalDate ? { finalDate: examDates.finalDate } : {}),
      };

      // Deduplicate sections by sectionNo
      const existingSecIndex = course.sections.findIndex((s) => s.sectionNo === section.sectionNo);
      if (existingSecIndex === -1) {
        course.sections.push(section);
      } else {
        course.sections[existingSecIndex] = section;
      }
    }
  }

  return Array.from(courseMap.values()).filter((c) => c.sections.length > 0);
}
```

---

### 4.2 `src/app/api/sections/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { fetchUrsa } from '@/lib/ursa/client';
import { decodeUrsaResponse } from '@/lib/ursa/decoder';
import { parseUrsaForm } from '@/lib/ursa/sectionParser';

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

    const response = await fetchUrsa('/seat/seat1.cfm', session.cookie);

    if (!response.ok && response.status >= 500) {
      return NextResponse.json(
        { error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const html = await decodeUrsaResponse(response);
    const form = parseUrsaForm(html);

    return NextResponse.json(
      {
        ok: true,
        html,
        form: form || {
          action: 'seat1.cfm',
          method: 'GET',
          controls: [],
        },
      },
      {
        status: 200,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  } catch (error: any) {
    console.error('[URSA Sections Form Route Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถดึงข้อมูล Course Sections ได้' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
```

---

### 4.3 `src/app/api/sections/query/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { URSA_BASE_URL, fetchUrsa, isAllowedUrsaHost } from '@/lib/ursa/client';
import { decodeUrsaResponse } from '@/lib/ursa/decoder';
import { parseSectionsHtml } from '@/lib/ursa/sectionParser';
import { Course } from '@/types/schedule';
import { UrsaQueryRequest } from '@/types/ursa';

export async function POST(request: NextRequest) {
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

    let body: UrsaQueryRequest;
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const {
      action = 'seat1.cfm',
      method = 'GET',
      fields = {},
      courseCodes,
      academicYear,
      semester,
      option1 = '1',
    } = body;

    // SSRF & Whitelist Target URL validation
    let targetUrl: URL;
    try {
      targetUrl = new URL(action || 'seat1.cfm', `${URSA_BASE_URL}/seat/seat1.cfm`);
    } catch {
      return NextResponse.json(
        { error: 'Invalid URSA form target' },
        { status: 400 }
      );
    }

    if (!isAllowedUrsaHost(targetUrl.hostname) || !targetUrl.pathname.startsWith('/seat/')) {
      return NextResponse.json(
        { error: 'Invalid URSA form target' },
        { status: 400 }
      );
    }

    // Branch A: Structured Multi-Course Query
    if (Array.isArray(courseCodes) && courseCodes.length > 0) {
      const allCourses: Course[] = [];
      const htmlSnippets: string[] = [];

      for (const rawCode of courseCodes) {
        const code = rawCode.trim();
        if (!code) continue;

        const queryParams = new URLSearchParams({
          acdyr: academicYear || '2569',
          sem: semester || '1',
          course_code: code,
          option1: option1 || '1',
        });

        const singleTarget = new URL(`${URSA_BASE_URL}/seat/seat1.cfm?${queryParams.toString()}`);
        const response = await fetchUrsa(singleTarget.toString(), session.cookie, {
          method: 'GET',
          headers: {
            Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
          },
        });

        if (response.ok) {
          const html = await decodeUrsaResponse(response);
          htmlSnippets.push(html);
          const parsedCourses = parseSectionsHtml(html, code);
          allCourses.push(...parsedCourses);
        }
      }

      return NextResponse.json(
        {
          ok: true,
          courses: allCourses,
          html: htmlSnippets.join('\n\n'),
        },
        {
          status: 200,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    // Branch B: Raw Form Proxy Submission
    const httpMethod = (method || 'GET').toUpperCase();
    let queryResponse: Response;

    if (httpMethod === 'GET') {
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          targetUrl.searchParams.set(key, String(value));
        }
      });

      queryResponse = await fetchUrsa(targetUrl.toString(), session.cookie, {
        method: 'GET',
        headers: {
          Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
        },
      });
    } else {
      const formParams = new URLSearchParams();
      Object.entries(fields).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          formParams.set(key, String(value));
        }
      });

      queryResponse = await fetchUrsa(targetUrl.toString(), session.cookie, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Referer: `${URSA_BASE_URL}/seat/seat1.cfm`,
        },
        body: formParams.toString(),
      });
    }

    if (!queryResponse.ok && queryResponse.status >= 500) {
      return NextResponse.json(
        { error: 'ไม่สามารถค้นหา Section ได้ในขณะนี้' },
        {
          status: 502,
          headers: {
            'Cache-Control': 'no-store, max-age=0',
          },
        }
      );
    }

    const html = await decodeUrsaResponse(queryResponse);
    const fallbackCode = fields.course_code || fields.coursecode || fields.course || fields.subject;
    const courses = parseSectionsHtml(html, fallbackCode);

    return NextResponse.json(
      {
        ok: true,
        courses,
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
    console.error('[URSA Sections Query Route Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถค้นหา Section ได้ในขณะนี้' },
      {
        status: 502,
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      }
    );
  }
}
```

---

## 5. Verification Method

To independently verify the Milestone 3 implementation:

### 5.1 Verification Test Suite (`src/lib/ursa/__tests__/m3_sections.test.ts`)
Run the test runner covering:
1. `normalizeDayOfWeek`: Verifies Thai days (จันทร์, อังคาร, พุธ, พฤหัส, ศุกร์, เสาร์), abbreviations, lowercase, noisy whitespace.
2. `parseTimeRange`: Verifies `09:00 - 12:00`, `09.00 - 12.00`, `13:30-16:30`, and invalid formats.
3. `parseSeatCount`: Verifies `12 / 40`, `0 / 35`, single integers `40`, closed status `เต็ม (0/40)`.
4. `parseUrsaForm`: Verifies extracting `acdyr`, `sem`, `course_code`, `option1`, select options and default values.
5. `parseSectionsHtml`: Verifies standard table, multiple courses, zero-seat courses, exam dates, lab room detection, and fallback code injection.
6. `GET /api/sections`: Verifies 401 without cookie, 401 on expired session, 200 with form JSON on active session, 502 on upstream failure.
7. `POST /api/sections/query`: Verifies 401 without cookie, 400 on SSRF target (`https://attacker.com/leak`), 200 on raw form query, 200 on multi-course array query, and 502 on network errors.

### 5.2 Build Conformance Command
```powershell
npm run build
```
Expected output: 0 TypeScript errors, all route handlers compiled cleanly.

### 5.3 Invalidation Conditions
- If URSA modifies table headers to omit `/Seat\(s\)/i` or `/Status/i`, fallback table selector ensures resilient detection.
- If upstream rejects requests without `Referer: https://ursa2.bu.ac.th/seat/seat1.cfm`, header is explicitly passed in all fetch calls.
