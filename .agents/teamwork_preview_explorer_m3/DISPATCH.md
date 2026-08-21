## 2026-08-21T04:11:18+07:00
You are an Explorer agent for Milestone 3: Dynamic Course & Section Query.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m3`.

Read:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\TEST_INFRA.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`
- `src/types/schedule.ts`
- `src/types/ursa.ts`
- `src/lib/ursa/sessionStore.ts`
- `src/lib/ursa/decoder.ts`
- `src/lib/ursa/client.ts`
- Reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU` (specifically `app.js` and `server.js` regarding `/seat/seat1.cfm`, form discovery, query proxy, and HTML table section parsing).

Investigate and produce a detailed blueprint for:
1. `src/lib/ursa/sectionParser.ts`:
   - Pure DOM/Regex parser function `parseSectionsHtml(html: string, fallbackCourseCode?: string): Course[]`.
   - How `ScheduleBU/app.js` extracts tables containing `/Seat\(s\)/i` and `/Status/i`.
   - Parsing each row into `Section` objects: `sectionNo`, `availableSeats`, `totalSeats`, `status`, `type` (`LECT`/`LAB`), `day` (`MON`..`SAT`), `startTime` (`09:00`), `endTime` (`12:00`), `room`, `instructor`, `midtermDate`, `finalDate`, `restriction`.
   - Normalizing days (`Mon`, `จันทร์`, `MO` -> `MON`) and times (`09.00 - 12.00` -> `09:00`, `12:00`).
   - Parsing form controls from `/seat/seat1.cfm` (`acdyr`, `sem`, etc.).
2. `src/app/api/sections/route.ts`:
   - GET handler for form metadata discovery.
   - Validates `buplaner_session`. Returns 401 if missing/expired.
   - Proxies GET `https://ursa2.bu.ac.th/seat/seat1.cfm` with session cookie and decodes via `decodeUrsaResponse`.
   - Returns `{ ok: true, html, form: { action, controls } }`.
3. `src/app/api/sections/query/route.ts`:
   - POST handler for section search queries.
   - Validates `buplaner_session`. Returns 401 if missing/expired.
   - Supports both single form submission (`fields`, `action`) and multi-course query (`courseCodes: string[]`, `academicYear`, `semester`).
   - Security: Whitelist validation for upstream origin (`https://ursa2.bu.ac.th`) and path (`/seat/`). Reject SSRF with 400 Bad Request.
   - Proxies to upstream with proper `Referer` and session cookies. Decodes responses and parses tables into structured `Course[]`.
   - Returns 200 `{ ok: true, courses: Course[], html }`.
   - Handles upstream errors with 502.

Write your findings and code blueprints to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m3\handoff.md`.
Use send_message to report completion.
