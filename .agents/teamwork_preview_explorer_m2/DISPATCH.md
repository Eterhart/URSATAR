## 2026-08-20T21:00:12Z
You are an Explorer agent for Milestone 2: Student Profile Fetcher.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m2`.

Read:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\TEST_INFRA.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\src\types\ursa.ts`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\src\lib\ursa\sessionStore.ts`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\src\lib\ursa\decoder.ts`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\src\lib\ursa\client.ts`
- Reference implementation in `C:\Users\Nisha\Downloads\ScheduleBU` (specifically `app.js` and `server.js` regarding `/remark/remark.cfm` and profile extraction).

Investigate:
1. `src/lib/ursa/profileParser.ts`:
   - How `ScheduleBU/app.js` parses the Grade Report HTML (`/remark/remark.cfm`).
   - Pure DOM/Regex parser function `parseProfileHtml(html: string): { studentId: string; studentName: string; meta?: string }`.
   - Normalizing whitespace, handling Thai text correctly (already decoded from Windows-874).
   - Robust fallback if Grade Report table is missing/empty.
2. `src/app/api/profile/route.ts`:
   - Next.js App Router GET route handler.
   - Extracts session cookie `buplaner_session` from request.
   - Checks session validity via `sessionStore.getSession(token)`.
   - Calls `ursaClient.fetchProfile(session.cookie)` (or upstream GET `https://ursa2.bu.ac.th/remark/remark.cfm` with session cookie and decodes with `decodeBuffer`).
   - Parses profile and returns 200 `{ ok: true, studentId, studentName, meta, html }`.
   - Handles unauthenticated with 401 `{ error: "Connect URSA first" }` and upstream failure with 502 `{ error: "ไม่สามารถดึงข้อมูลโปรไฟล์ได้" }`.

Write your full analysis and implementation strategy to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m2\handoff.md`.
Then use `send_message` to report completion.
