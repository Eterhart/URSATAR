## 2026-08-21T03:13:00Z
You are Worker for Milestone 1: URSA Authentication & Session Proxy.
Your working directory is `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_worker_m1`.
Read:
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\ORIGINAL_REQUEST.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\PROJECT.md`
- `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m1\analysis.md`

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Your task:
Implement Milestone 1 according to the blueprint in `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m1\analysis.md`.
Exclusive file ownership:
1. `src/types/ursa.ts`
2. `src/lib/ursa/sessionStore.ts`
3. `src/lib/ursa/decoder.ts`
4. `src/lib/ursa/client.ts`
5. `src/app/api/auth/login/route.ts`
6. `src/app/api/auth/status/route.ts`
7. `src/app/api/auth/logout/route.ts`

Requirements:
1. Genuine upstream communication with `https://ursa2.bu.ac.th`.
2. Landing seed pre-flight to `/seat/seat1.cfm` to capture initial `CFID`/`CFTOKEN` cookies.
3. POST credentials (`liveid`, `inter_passwd`, `option1`) to `https://ursa2.bu.ac.th/SetFullId.cfm` with referer and cookie jar.
4. Multi-hop 302 redirect tracking (up to 5 hops) accumulating all cookies from `Set-Cookie` headers.
5. Windows-874 decoding via `TextDecoder('windows-874')` (with fallback).
6. Rejection detection via `/Access Denied|User name.*Password/i`.
7. Session store with 1-hour TTL, crypto token generation, and `globalThis` persistence in dev mode.
8. HTTP-only session cookie `buplaner_session` on `/api/auth/login` and `/api/auth/logout`.
9. `/api/auth/status` returning `{ connected: boolean }`.
10. Test and verify TypeScript compilation and `npm run build`.

Output requirements:
Write your implementation report to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_worker_m1\changes.md` and handoff to `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_worker_m1\handoff.md`.
Include build output and test results in handoff.md. Report back when finished.
