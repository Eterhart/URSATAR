## 2026-08-20T20:07:56Z

<USER_REQUEST>
You are Spec Miner (Requirements & Interface Architect).
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec`.
Read `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`.

Your mission:
Investigate both `C:\Users\Nisha\Downloads\ScheduleBU` and `c:\Users\Nisha\antigravity\quick-chandrasekhar` to extract precise specifications, feature requirements, error states, and API interface contracts for:
1. `/api/auth/login`, `/api/auth/status`, `/api/auth/logout`: Request payload, upstream URL/headers/cookies, response JSON format, cookie options for `buplaner_session`, error codes (e.g. invalid credentials, URSA down, timeout).
2. `/api/profile`: Request headers (cookie forwarding), upstream URL `/remark/remark.cfm`, windows-874 response decoding, JSON response schema (`studentId`, `studentName`, etc.), error handling for unauthenticated / expired sessions.
3. `/api/sections` & `/api/sections/query`: Upstream URLs (`/seat/seat1.cfm`), parameters (`sem`, `acadyear`, `course_code`, etc.), HTML table parsing rules into structured JSON compatible with the Next.js timetable data models.
4. Complete Feature Inventory (enumerating every discrete feature for R1, R2, R3, R4) with verification criteria for E2E testing.

Output requirements:
Write your comprehensive specification report to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md` and handoff to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\handoff.md`.
Report back when finished.
</USER_REQUEST>
