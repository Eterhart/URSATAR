## 2026-08-21T04:13:18+07:00
You are a Worker agent implementing Milestone 3: Dynamic Course & Section Query for Bangkok University URSA Live Integration.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_worker_m3`.

Read:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\TEST_INFRA.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m3\handoff.md`
- Existing files:
  - `src/types/schedule.ts`
  - `src/types/ursa.ts`
  - `src/lib/ursa/sessionStore.ts`
  - `src/lib/ursa/decoder.ts`
  - `src/lib/ursa/client.ts`
  - `src/data/mockCourses.ts`

Your task:
Implement Milestone 3:
1. `src/lib/ursa/sectionParser.ts`:
   - Pure DOM/Regex parser for `/seat/seat1.cfm` HTML.
   - `cleanHtmlText`: entity decoding, tag removal, whitespace cleanup.
   - `normalizeDayOfWeek`: maps Thai & English days to `DayOfWeek` (`MON`..`SAT`).
   - `parseTimeRange`: parses times into `HH:MM` format.
   - `parseSeatCount`: parses `availableSeats` and `totalSeats`.
   - `parseExamDates`: extracts midterm and final exam dates.
   - `parseUrsaForm`: extracts `<form>`, `<select>`, `<input>` controls from `/seat/seat1.cfm`.
   - `parseSectionsHtml`: extracts candidate tables, course codes, and rows into `Course[]` with `Section[]` details.
2. `src/app/api/sections/route.ts`:
   - Next.js App Router GET route handler.
   - Validates `buplaner_session` cookie via `getSession()`. Returns 401 if missing/expired.
   - Proxies GET `https://ursa2.bu.ac.th/seat/seat1.cfm` with session cookie and decodes via `decodeUrsaResponse`.
   - Parses form controls via `parseUrsaForm(html)`.
   - Returns 200 `{ ok: true, html, form }` with `Cache-Control: no-store, max-age=0`.
   - Handles 5xx / upstream error with 502.
3. `src/app/api/sections/query/route.ts`:
   - Next.js App Router POST route handler.
   - Validates `buplaner_session` cookie via `getSession()`. Returns 401 if missing/expired.
   - Whitelists target URL: `isAllowedUrsaHost(targetUrl.hostname)` and `targetUrl.pathname.startsWith('/seat/')`. Returns 400 Bad Request on SSRF attempts.
   - Supports both `courseCodes` array queries and single `fields` raw form proxy queries.
   - Forwards queries with `session.cookie` and `Referer: https://ursa2.bu.ac.th/seat/seat1.cfm`.
   - Decodes response via `decodeUrsaResponse` and parses courses via `parseSectionsHtml`.
   - Returns 200 `{ ok: true, courses: Course[], html: string }` with `Cache-Control: no-store, max-age=0`.
   - Handles upstream errors with 502.

4. Run verification:
   - Run `npm run build` to verify there are 0 TypeScript / compilation errors.
   - Create test script to verify all parsing and route behaviors.
