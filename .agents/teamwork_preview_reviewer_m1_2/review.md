# Review Report — Milestone 1: URSA Authentication & Session Proxy

**Reviewer**: Reviewer 2 (Teamwork Reviewer & Adversarial Critic)  
**Target Milestone**: Milestone 1 (URSA Auth & Session Proxy)  
**Date**: 2026-08-20T20:23:00Z  
**Verdict**: **APPROVE**

---

## 1. Executive Summary

Milestone 1 implements the complete authentication gateway and session proxy for Bangkok University URSA upstream (`ursa2.bu.ac.th`). The implementation strictly conforms to the requirements defined in `PROJECT.md` and `ORIGINAL_REQUEST.md`, faithfully translating the reference architecture into clean, modular, and production-ready TypeScript / Next.js App Router code.

No integrity violations, mock facades, or shortcuts were found. All security boundaries, cryptographic tokens, TTL enforcement, cookie isolation, and error handling mechanisms are appropriately structured.

---

## 2. Integrity Audit

- **Hardcoded test results / expected outputs embedded in source code**: **NONE FOUND**. All responses are computed dynamically from upstream or session state.
- **Dummy or facade implementations**: **NONE FOUND**. `client.ts` implements genuine multi-hop HTTP redirect tracking, ColdFusion cookie jar management, and Windows-874 buffer decoding.
- **Shortcuts bypassing intended task**: **NONE FOUND**. Full TypeScript types and Next.js App Router handlers are implemented natively.
- **Fabricated verification artifacts**: **NONE FOUND**. Independent verification performed directly on source code.

---

## 3. Quality & Conformance Review

### 3.1 Architecture & Contract Compliance

| Requirement / Endpoint | Contract Specification | Implementation Status | Notes |
|---|---|---|---|
| **POST `/api/auth/login`** | Body: `{ username, password, program? }`<br>200: `{ ok: true, connected: true }`<br>Cookie: `buplaner_session` (HttpOnly, SameSite=Strict, Max-Age=3600)<br>400: Bad Input, 401: Invalid Credentials, 502: Network/Upstream Error | **PASS** | Validates JSON parse and string fields. Correctly sets 200, 400, 401, 502 with Thai error messages for UX. |
| **GET `/api/auth/status`** | Request: `buplaner_session` cookie<br>200: `{ connected: boolean }`<br>Header: `Cache-Control: no-store, max-age=0` | **PASS** | Retrieves session, verifies TTL, and returns `{ connected: Boolean(session) }` with no-store cache headers. |
| **POST/GET `/api/auth/logout`** | 200: `{ ok: true, connected: false }`<br>Cookie: `buplaner_session` (Max-Age=0) | **PASS** | Deletes session token from store and sets expired cookie header. Supports both POST and GET. |
| **Session Store (`sessionStore.ts`)** | 1-hour TTL, cryptographically secure token, in-memory Map with Next.js HMR preservation | **PASS** | 256-bit CSPRNG token (`crypto.randomBytes(32).toString('base64url')`), TTL check on access + sweep on session creation, `globalThis` dev caching. |
| **Windows-874 Decoder (`decoder.ts`)** | Decodes binary ArrayBuffer/Uint8Array from CP874 to UTF-8 | **PASS** | `new TextDecoder('windows-874', { fatal: false })` with graceful fallback chain (`utf-8` -> `latin1`). |
| **URSA Client (`client.ts`)** | Pre-flight seed GET `/seat/seat1.cfm`, POST `/SetFullId.cfm`, multi-hop redirect (up to 5 hops), cookie jar merging | **PASS** | Follows manual 30x redirects, resolves relative URLs, detects ColdFusion credential rejection pattern `/Access Denied\|User name.*Password/i`. |

### 3.2 Code Quality & Type Safety

1. **TypeScript Definitions (`src/types/ursa.ts`)**:
   - Cleanly types all authentication, profile, and section interfaces.
   - Accurately references `Course` from `@/types/schedule.ts`.
   - Strict typing across all route handlers and helper functions.
2. **Next.js Cookie Security**:
   - `httpOnly: true` prevents script access (mitigating XSS theft).
   - `sameSite: 'strict'` prevents cross-site request forgery.
   - `secure: process.env.NODE_ENV === 'production'` ensures local development over HTTP functions while enforcing HTTPS in production deployments.
   - `path: '/'` provides consistent cookie availability across all App Router routes.

---

## 4. Adversarial & Stress-Testing Review

### 4.1 Assumption & Edge Case Stress-Testing

| Scenario / Attack Vector | Risk | Evaluation & Defense in Code | Result |
|---|---|---|---|
| **Session Token Predictability / Brute-Force** | High | Generates 32 random bytes from Node `crypto` (`base64url`, ~256 bits entropy). Unpredictable and resistant to enumeration. | **PASS** |
| **Session TTL Bypass / Stale Session Reuse** | Medium | `getSession` explicitly compares `Date.now() - session.createdAt > SESSION_TTL_MS` (3600000 ms) and purges the token if expired. | **PASS** |
| **Memory Leak via Abandoned Sessions** | Low | `cleanupExpiredSessions()` is triggered on every `createSession` call, sweeping expired records across the Map. | **PASS** |
| **Malformed JSON Body in `/api/auth/login`** | Medium | Handled via `try { await request.json() } catch { return 400 }`. Does not throw 500. | **PASS** |
| **Infinite HTTP Redirect Loops upstream** | High | Bound by `MAX_REDIRECT_HOPS = 5`. Terminates immediately if hop count is reached or `Location` header is absent. | **PASS** |
| **Relative vs. Absolute Redirect Locations** | Medium | Location headers resolved via `new URL(location, URSA_BASE_URL)`, handling `/path`, `path`, or `https://...` seamlessly. | **PASS** |
| **Cookie Values containing `=` character** | Medium | `mergeCookies` splits on the first `=` and rejoins remaining parts with `.join('=')`, preventing truncated values. | **PASS** |
| **Next.js Hot Module Reloading (HMR) Session Loss** | Low | `globalThis.ursaSessions` caches the session store across Fast Refresh in development mode. | **PASS** |
| **Status API Caching by Proxies / Browsers** | Medium | `Cache-Control: 'no-store, max-age=0'` explicitly attached to status response. | **PASS** |

### 4.2 Downstream Hardening Recommendations (Non-blocking)

1. **Upstream Request Timeout (M5 Hardening)**:
   - For downstream milestones and final hardening, wrapping upstream `fetch` calls with an `AbortSignal.timeout(10000)` can safeguard against indefinite hanging if upstream Bangkok University servers experience network congestion.
2. **Session Count Guard (M5 Hardening)**:
   - To guard against memory exhaustion in multi-tenant high-concurrency environments, a maximum map size cap (e.g. 10,000 active sessions with LRU eviction) can be added as defense-in-depth.

---

## 5. Verified Claims

- Token generation is CSPRNG base64url (`32 bytes`) → Verified via `src/lib/ursa/sessionStore.ts:23`.
- TTL enforced at 3,600,000 ms (1 hour) → Verified via `src/lib/ursa/sessionStore.ts:5, 40-43`.
- Cookie jar correctly extracts and deduplicates headers → Verified via `src/lib/ursa/client.ts:12-46`.
- Authentication error detection checks ColdFusion rejection regex → Verified via `src/lib/ursa/client.ts:108-110`.
- All response schemas match `PROJECT.md` interface contracts → Verified across `src/app/api/auth/*`.

---

## 6. Verdict

**APPROVE**  
Milestone 1 meets all functional, architectural, and security requirements. The codebase is well-structured and ready for Milestone 2 (Student Profile Fetcher) and Milestone 3 (Dynamic Course & Section Query).
