# Handoff Report: Survey Reference Implementation (ScheduleBU)

## 1. Observation

Direct observations from the reference codebase in `C:\Users\Nisha\Downloads\ScheduleBU`:

- **File Structure**:
  - `server.js` (lines 1–61): Core backend server handling HTTP routing, URSA authentication, session management, and upstream proxying.
  - `app.js` (lines 1–67): Client-side application logic for DOM manipulation, URSA form parsing, profile extraction, and schedule rendering.
  - `index.html` (lines 1–98): Main HTML structure with login dialog, search forms, and weekly calendar view.
  - `styles.css` (lines 1–2): CSS styles for layout, sidebar, tables, and colors.
  - `PRODUCT.md` (lines 1–28): High-level product specifications and design goals.
  - `package.json` (lines 1–7): Node.js package definition (`bu-planer`).

- **URSA Authentication (`server.js:16-30`)**:
  ```javascript
  async function ursalogin(username, password, program) {
    const body = new URLSearchParams({ liveid: username, inter_passwd: password, option1: program === 'buic' ? '2' : '1' });
    const landing = await fetch(`${URSA}/seat/seat1.cfm`, { redirect: 'manual' });
    let cookie = upstreamCookie(landing);
    let response = await fetch(`${URSA}/SetFullId.cfm`, { method: 'POST', redirect: 'manual', headers: { 'content-type': 'application/x-www-form-urlencoded', cookie, referer: `${URSA}/seat/seat1.cfm` }, body });
    cookie = [cookie, upstreamCookie(response)].filter(Boolean).join('; ');
    for (let i = 0; i < 5 && response.status >= 300 && response.status < 400; i += 1) {
      const location = response.headers.get('location'); if (!location) break;
      response = await fetch(new URL(location, URSA), { redirect: 'manual', headers: { cookie } });
      cookie = [cookie, upstreamCookie(response)].filter(Boolean).join('; ');
    }
    const html = await ursaText(response);
    if (!cookie || /Access Denied|User name.*Password/i.test(html)) throw new Error('URSA rejected the credentials');
    return cookie;
  }
  ```

- **Encoding & Decoding (`server.js:14`)**:
  ```javascript
  async function ursaText(response) { return new TextDecoder('windows-874').decode(await response.arrayBuffer()); }
  ```

- **Profile Fetching & Parsing (`server.js:53`, `app.js:58-60`)**:
  - Upstream endpoint: `GET https://ursa2.bu.ac.th/remark/remark.cfm`.
  - DOM query:
    ```javascript
    const report = [...documentFromUrsa.querySelectorAll('table')].find((table) => /Grade Report/i.test(table.textContent) && /Student\s*ID/i.test(table.textContent) && /\bName\b/i.test(table.textContent));
    const cells = [...report.querySelectorAll('td,th')];
    const nameIndex = cells.findIndex((cell) => /^name$/i.test(cell.textContent.trim()));
    const idIndex = cells.findIndex((cell) => /^student\s*id$/i.test(cell.textContent.trim()));
    const name = cells[nameIndex + 1]?.textContent.replace(/\s+/g, ' ').trim();
    const studentId = cells[idIndex + 1]?.textContent.replace(/\s+/g, ' ').trim();
    ```

- **Section Query & Parsing (`server.js:43-52`, `app.js:30-33, 50-54`)**:
  - Form discovery scans for controls with names matching `/year|term|course|section|acd|sem/i`.
  - Query POST endpoint: proxies to `new URL(action || 'seat1.cfm', `${URSA}/seat/seat1.cfm`)` validating `target.pathname.startsWith('/seat/')`.
  - Results parsing locates table matching `/Seat\(s\)/i.test(table.textContent) && /Status/i.test(table.textContent) && table.querySelectorAll('tr').length > 3`.
  - Parses rows with `cells.length >= 9`:
    - `cells[0]`: Section number
    - `cells[5]`: Type (e.g. LECT, LAB)
    - `cells[6]`: Day
    - `cells[7]`: Time (matched via `/(\d{1,2})[.:](\d{2})\s*-\s*(\d{1,2})[.:](\d{2})/`)
    - `cells[8]`: Room

---

## 2. Logic Chain

1. **Premise 1 (Authentication Requirements)**: From `server.js:16-30`, authentication is stateful and relies on upstream ColdFusion session cookies (`CFID`, `CFTOKEN`, `JSESSIONID`) acquired across multiple 302 redirects initiated by `SetFullId.cfm`.
2. **Premise 2 (Encoding Constraints)**: From `server.js:14`, all URSA endpoints emit text encoded in Thai Windows-874. Reading responses directly as UTF-8 string corrupts Thai characters, necessitating `TextDecoder('windows-874')` over raw `arrayBuffer()`.
3. **Premise 3 (Session Model)**: From `server.js:38-40`, the application issues an HTTP-only session cookie (`buplaner_session`) to the browser, while the server maintains the active upstream cookie string mapped to that session ID.
4. **Premise 4 (Profile Parsing Strategy)**: From `app.js:58-60`, student identification data is embedded within the tabular structure of `/remark/remark.cfm`, specifically adjacent to the literal label cells `"Student ID"` and `"Name"`.
5. **Premise 5 (Section Search Flow)**: From `server.js:44-52` and `app.js:30-56`, section seat queries are executed against `/seat/seat1.cfm` using parameters derived either from dynamic form discovery or explicit course query fields, and result rows map predictably to section numbers, meeting times, room allocations, and seat availability.
6. **Inference / Conclusion**: Implementing these upstream flows in Next.js route handlers (`/api/auth/*`, `/api/profile`, `/api/sections/*`) alongside a dedicated server-side parser module (`ursaParser.ts`) will seamlessly replace mock data with live URSA data without breaking existing Apple UI components.

---

## 3. Caveats

- **Network Availability**: Live connection to `https://ursa2.bu.ac.th` requires network reachability to the BU intranet/public URSA host from the server runtime.
- **Serverless Session Store**: In multi-instance or serverless Next.js deployments, an in-memory `Map` is local to the instance. For single-server or development instances, a global in-memory map or an encrypted session cookie containing the upstream cookie string is recommended.
- **Batch Query Support**: URSA's `/seat/seat1.cfm` natively queries one course at a time. The frontend planner in `quick-chandrasekhar` allows entering multiple course codes (e.g. `CS422 CS430 CS441`), so the Next.js API layer or client must handle multi-course queries by issuing concurrent or sequenced requests per course code.

---

## 4. Conclusion

The reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU` provides a complete, tested blueprint for URSA integration:
- Authentication via `/SetFullId.cfm` with `liveid`, `inter_passwd`, `option1`, and manual 302 redirect tracking.
- Response payload decoding using `new TextDecoder('windows-874')`.
- Student metadata parsing from `/remark/remark.cfm`.
- Section table parsing from `/seat/seat1.cfm`.

The implementation in `quick-chandrasekhar` can be systematically implemented via Next.js App Router route handlers in `src/app/api/` and connected to existing React components (`LoginModal`, `CourseExplorer`, `Header`, `EnrolledCoursesTable`, `UnselectedCoursesTable`).

---

## 5. Verification Method

1. **Codebase Inspection**:
   - Inspect `C:\Users\Nisha\Downloads\ScheduleBU\server.js` lines 14–60 to confirm request headers, methods, redirect loop, and encoding logic.
   - Inspect `C:\Users\Nisha\Downloads\ScheduleBU\app.js` lines 30–60 to confirm regex matchers for student profile and section results.
2. **Analysis Report Verification**:
   - Review `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_survey_ref\analysis.md` for complete technical breakdown.
