## 2026-08-20T20:10:33Z
You are Explorer for Milestone 1: URSA Authentication & Session Proxy.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m1`.
Read:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_spec_miner_survey_spec\spec.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_survey_ref\analysis.md`

Your mission:
Analyze the implementation requirements for Milestone 1:
1. Core URSA modules to create under `src/lib/ursa/`:
   - `src/lib/ursa/sessionStore.ts`: In-memory session store with TTL (1 hour), crypto token generation, session retrieval and deletion.
   - `src/lib/ursa/decoder.ts`: Robust windows-874 buffer decoder to UTF-8 using `TextDecoder('windows-874')` (or `iconv-lite` fallback).
   - `src/lib/ursa/client.ts`: URSA HTTP client handling landing seed (`/seat/seat1.cfm`), login POST (`/SetFullId.cfm`), multi-hop redirect following (up to 5 hops), cookie jar accumulation, windows-874 response decoding, and credential rejection detection (`/Access Denied|User name.*Password/i`).
2. Next.js App Router API Route Handlers:
   - `src/app/api/auth/login/route.ts`: POST route parsing `{ username, password, program }`, calling URSA login, establishing session, and setting HTTP-only `buplaner_session` cookie.
   - `src/app/api/auth/status/route.ts`: GET route reading `buplaner_session` cookie and returning `{ connected: boolean }`.
   - `src/app/api/auth/logout/route.ts`: POST route clearing session and clearing `buplaner_session` cookie.
3. TypeScript definitions in `src/types/ursa.ts`.
4. Any package dependencies required (e.g. check if `iconv-lite` is installed or needed).

Produce a detailed implementation blueprint for the Worker.
Write your analysis to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m1\analysis.md` and handoff to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m1\handoff.md`.
Report back when complete.
