# Milestone 1 Technical Analysis & Implementation Blueprint
## URSA Authentication & Session Proxy

**Document Version**: 1.0.0  
**Target Milestone**: Milestone 1 (M1: URSA Auth & Session Proxy)  
**Author**: Explorer M1 (URSA Auth & Session Proxy Investigator)  
**Target Directory**: `c:\Users\Nisha\antigravity\quick-chandrasekhar`  
**Working Directory**: `c:\Users\Nisha\antigravity\quick-chandrasekhar\.agents\teamwork_preview_explorer_m1`  
**Date**: 2026-08-21  

---

## 1. Executive Summary

Milestone 1 establishes the foundational communication and authentication layer between the Next.js timetable planner (`quick-chandrasekhar`) and the Bangkok University URSA ColdFusion upstream service (`https://ursa2.bu.ac.th`).

### Core Objectives:
1. **Type Definitions** (`src/types/ursa.ts`): Type-safe contracts for login credentials, URSA sessions, authentication status, profile responses, form descriptors, and section queries.
2. **Session Store** (`src/lib/ursa/sessionStore.ts`): Thread-safe in-memory session manager with 1-hour TTL, cryptographically secure 32-byte `base64url` token generation, singleton persistence across Next.js dev reloads (`globalThis`), and expiration sweepers.
3. **Windows-874 Decoder** (`src/lib/ursa/decoder.ts`): Binary buffer decoder converting raw Thai Windows-874 / CP874 payloads into UTF-8 strings using `TextDecoder('windows-874')` with fallback safeguards.
4. **URSA HTTP Client** (`src/lib/ursa/client.ts`): Multi-step authentication handshake client that executes landing seed requests (`/seat/seat1.cfm`), submits login credentials (`/SetFullId.cfm`), follows up to 5 HTTP 30x redirects while accumulating `CFID`/`CFTOKEN`/`JSESSIONID` cookies, and validates responses against rejection patterns (`/Access Denied|User name.*Password/i`).
5. **Next.js App Router API Route Handlers**:
   - `POST /api/auth/login` (`src/app/api/auth/login/route.ts`): Authenticates credentials, generates session, and issues HTTP-Only `buplaner_session` cookie.
   - `GET /api/auth/status` (`src/app/api/auth/status/route.ts`): Validates session cookie existence and unexpired TTL.
   - `POST /api/auth/logout` (`src/app/api/auth/logout/route.ts`): Deletes session token from memory and invalidates client cookie (`Max-Age=0`).

---

## 2. Upstream Handshake & Protocol Flow

```
Client Browser                         Next.js Server                       URSA Upstream (https://ursa2.bu.ac.th)
      │                                      │                                                │
      ├──── 1. POST /api/auth/login ────────>│                                                │
      │        { username, password, prog }  ├──── 2. GET /seat/seat1.cfm (Pre-flight) ───────>│
      │                                      │<─── 3. 200 OK + Set-Cookie: CFID/CFTOKEN ──────┤
      │                                      │                                                │
      │                                      ├──── 4. POST /SetFullId.cfm (liveid, passwd) ───>│
      │                                      │<─── 5. 302 Found + Set-Cookie (Hop 1) ─────────┤
      │                                      │                                                │
      │                                      ├──── 6. GET /redirect/target (Manual Hop 2..5) ─>│
      │                                      │<─── 7. 200 OK + Set-Cookie (Final Body) ───────┤
      │                                      │                                                │
      │                                      │  [Decode Windows-874 -> Check Rejection Regex] │
      │                                      │  [Generate Crypto base64url Token -> Store]    │
      │<─── 8. 200 OK + buplaner_session ────┤                                                │
      │        { ok: true, connected: true } │                                                │
```

---

## 3. Detailed Component Blueprints

### 3.1 Type Definitions (`src/types/ursa.ts`)
Defines all data structures shared between URSA backend lib, API route handlers, and frontend consumers.

```typescript
import { Course } from './schedule';

export type UrsaProgram = 'regular' | 'buic';

export interface UrsaLoginCredentials {
  username: string;
  password: string;
  program?: UrsaProgram;
}

export interface UrsaSession {
  cookie: string;
  createdAt: number;
}

export interface UrsaLoginResponse {
  ok: boolean;
  connected?: boolean;
  error?: string;
}

export interface UrsaAuthStatusResponse {
  connected: boolean;
}

export interface UrsaLogoutResponse {
  ok: boolean;
  connected: boolean;
}

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

export interface UrsaFormControlOption {
  value: string;
  text: string;
}

export interface UrsaFormControl {
  name: string;
  type: string;
  value?: string;
  options?: UrsaFormControlOption[];
}

export interface UrsaForm {
  action: string;
  method: string;
  controls: UrsaFormControl[];
}

export interface UrsaSectionsResponse {
  ok: boolean;
  form?: UrsaForm;
  html?: string;
  error?: string;
}

export interface UrsaQueryRequest {
  academicYear?: string;
  semester?: string;
  courseCodes?: string[];
  action?: string;
  method?: string;
  fields?: Record<string, string>;
}

export interface UrsaQueryResponse {
  ok: boolean;
  courses?: Course[];
  html?: string;
  error?: string;
}
```

---

### 3.2 Session Store (`src/lib/ursa/sessionStore.ts`)

#### Architectural Details:
- **Token Generation**: Uses `crypto.randomBytes(32).toString('base64url')` producing a 43-character URL-safe cryptographic token.
- **TTL**: `3,600,000` ms (1 hour).
- **Next.js Dev Reload Preservation**: Persisted in `(globalThis as any).ursaSessions` to prevent session loss on Hot Module Reloading (HMR).
- **Cookie Name**: `buplaner_session`.

```typescript
import crypto from 'node:crypto';
import { UrsaSession } from '@/types/ursa';

export const SESSION_COOKIE_NAME = 'buplaner_session';
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour

// Preserve sessions across hot reloads in Next.js development
const globalForUrsa = globalThis as unknown as {
  ursaSessions?: Map<string, UrsaSession>;
};

export const sessionMap = globalForUrsa.ursaSessions ?? new Map<string, UrsaSession>();

if (process.env.NODE_ENV !== 'production') {
  globalForUrsa.ursaSessions = sessionMap;
}

/**
 * Creates a new session with cryptographically secure token
 */
export function createSession(cookie: string): string {
  cleanupExpiredSessions();
  const sessionId = crypto.randomBytes(32).toString('base64url');
  sessionMap.set(sessionId, {
    cookie,
    createdAt: Date.now(),
  });
  return sessionId;
}

/**
 * Retrieves an unexpired session by token
 */
export function getSession(sessionId: string | null | undefined): UrsaSession | null {
  if (!sessionId) return null;
  const session = sessionMap.get(sessionId);
  if (!session) return null;

  if (Date.now() - session.createdAt > SESSION_TTL_MS) {
    sessionMap.delete(sessionId);
    return null;
  }

  return session;
}

/**
 * Deletes a session by token
 */
export function deleteSession(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return sessionMap.delete(sessionId);
}

/**
 * Purges expired sessions
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessionMap.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessionMap.delete(id);
    }
  }
}
```

---

### 3.3 Windows-874 Decoder (`src/lib/ursa/decoder.ts`)

#### Architectural Details:
- Decodes raw binary buffer or Uint8Array using `new TextDecoder('windows-874', { fatal: false })`.
- Handles Thai vowels, tone marks, and character ranges without corruption.
- Provides fallback sequence to UTF-8 / Latin-1 if environment lacks specific codepages.

```typescript
/**
 * Decodes a binary buffer (ArrayBuffer, Uint8Array, or Buffer) encoded in windows-874 (CP874) to a UTF-8 string.
 */
export function decodeWindows874(buffer: ArrayBuffer | Uint8Array): string {
  try {
    const decoder = new TextDecoder('windows-874', { fatal: false });
    return decoder.decode(buffer);
  } catch {
    try {
      const utf8 = new TextDecoder('utf-8', { fatal: false });
      return utf8.decode(buffer);
    } catch {
      return Buffer.from(buffer).toString('latin1');
    }
  }
}

/**
 * Helper to fetch binary body from a Response and decode it as Windows-874.
 */
export async function decodeUrsaResponse(response: Response): Promise<string> {
  const arrayBuffer = await response.arrayBuffer();
  return decodeWindows874(arrayBuffer);
}
```

---

### 3.4 URSA HTTP Client (`src/lib/ursa/client.ts`)

#### Architectural Details:
- **Base URL**: `https://ursa2.bu.ac.th`
- **User Agent**: Realistic Desktop Chrome User-Agent header.
- **Cookie Jar Accumulation**: `mergeCookies` merges cookie key-value pairs while discarding expired/overwritten path metadata, producing clean `CFID=...; CFTOKEN=...; JSESSIONID=...` strings.
- **Redirect Chain**: Handles `status >= 300 && status < 400` with `redirect: 'manual'`, resolving `Location` headers relative to base URSA URL.
- **Rejection Pattern**: Regex check `/Access Denied|User name.*Password/i` against decoded response HTML.

```typescript
import { UrsaLoginCredentials } from '@/types/ursa';
import { decodeUrsaResponse } from './decoder';

export const URSA_BASE_URL = 'https://ursa2.bu.ac.th';
export const URSA_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const MAX_REDIRECT_HOPS = 5;

/**
 * Extracts raw Set-Cookie headers from a Response object into cookie string.
 */
export function extractUpstreamCookies(response: Response): string {
  const setCookieHeaders =
    typeof response.headers.getSetCookie === 'function'
      ? response.headers.getSetCookie()
      : [response.headers.get('set-cookie')].filter((c): c is string => Boolean(c));

  return setCookieHeaders
    .map((cookieStr) => cookieStr.split(';')[0].trim())
    .filter((part) => part.length > 0)
    .join('; ');
}

/**
 * Merges two cookie strings, updating matching keys with the newest value.
 */
export function mergeCookies(existingCookie: string, newCookies: string): string {
  const cookieMap = new Map<string, string>();

  function parse(str: string) {
    if (!str) return;
    str.split(';').forEach((part) => {
      const [key, ...val] = part.trim().split('=');
      if (key && key.trim()) {
        cookieMap.set(key.trim(), val.join('='));
      }
    });
  }

  parse(existingCookie);
  parse(newCookies);

  return Array.from(cookieMap.entries())
    .map(([key, val]) => `${key}=${val}`)
    .join('; ');
}

/**
 * Authenticates with URSA upstream, follows multi-hop redirects, and returns the accumulated session cookie.
 */
export async function loginUrsa(credentials: UrsaLoginCredentials): Promise<string> {
  const { username, password, program = 'regular' } = credentials;

  // Step 1: Pre-flight landing seed request
  const landingResponse = await fetch(`${URSA_BASE_URL}/seat/seat1.cfm`, {
    method: 'GET',
    redirect: 'manual',
    headers: {
      'User-Agent': URSA_USER_AGENT,
    },
  });

  let cookieJar = extractUpstreamCookies(landingResponse);

  // Step 2: Submit login credentials
  const body = new URLSearchParams({
    liveid: username.trim(),
    inter_passwd: password,
    option1: program === 'buic' ? '2' : '1',
  });

  let response = await fetch(`${URSA_BASE_URL}/SetFullId.cfm`, {
    method: 'POST',
    redirect: 'manual',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': URSA_USER_AGENT,
      'Referer': `${URSA_BASE_URL}/seat/seat1.cfm`,
      ...(cookieJar ? { Cookie: cookieJar } : {}),
    },
    body: body.toString(),
  });

  cookieJar = mergeCookies(cookieJar, extractUpstreamCookies(response));

  // Step 3: Multi-hop redirect following (up to 5 hops)
  for (let hop = 0; hop < MAX_REDIRECT_HOPS && response.status >= 300 && response.status < 400; hop++) {
    const location = response.headers.get('location');
    if (!location) break;

    const nextUrl = new URL(location, URSA_BASE_URL);
    response = await fetch(nextUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': URSA_USER_AGENT,
        'Referer': `${URSA_BASE_URL}/SetFullId.cfm`,
        ...(cookieJar ? { Cookie: cookieJar } : {}),
      },
    });

    cookieJar = mergeCookies(cookieJar, extractUpstreamCookies(response));
  }

  // Step 4: Verify authentication result
  const html = await decodeUrsaResponse(response);

  if (!cookieJar || /Access Denied|User name.*Password/i.test(html)) {
    throw new Error('URSA_REJECTED_CREDENTIALS');
  }

  return cookieJar;
}

/**
 * Proxies a request to URSA with authenticated session cookies.
 */
export async function fetchUrsa(
  pathOrUrl: string,
  sessionCookie?: string,
  init: RequestInit = {}
): Promise<Response> {
  const url = pathOrUrl.startsWith('http')
    ? pathOrUrl
    : `${URSA_BASE_URL}${pathOrUrl.startsWith('/') ? '' : '/'}${pathOrUrl}`;

  const headers = new Headers(init.headers);
  headers.set('User-Agent', URSA_USER_AGENT);
  if (sessionCookie) {
    headers.set('Cookie', sessionCookie);
  }

  return fetch(url, {
    ...init,
    headers,
  });
}
```

---

### 3.5 API Route: `POST /api/auth/login` (`src/app/api/auth/login/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { loginUrsa } from '@/lib/ursa/client';
import { createSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';
import { UrsaLoginCredentials } from '@/types/ursa';

export async function POST(request: NextRequest) {
  try {
    let body: Partial<UrsaLoginCredentials> = {};
    try {
      body = (await request.json()) as Partial<UrsaLoginCredentials>;
    } catch {
      return NextResponse.json(
        { error: 'Invalid JSON payload' },
        { status: 400 }
      );
    }

    const { username, password, program = 'regular' } = body;

    if (!username || typeof username !== 'string' || !username.trim() || !password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'username and password are required' },
        { status: 400 }
      );
    }

    const upstreamCookie = await loginUrsa({
      username: username.trim(),
      password,
      program: program === 'buic' ? 'buic' : 'regular',
    });

    const sessionId = createSession(upstreamCookie);

    const response = NextResponse.json({ ok: true, connected: true }, { status: 200 });

    response.cookies.set({
      name: SESSION_COOKIE_NAME,
      value: sessionId,
      httpOnly: true,
      sameSite: 'strict',
      path: '/',
      maxAge: 3600,
      secure: process.env.NODE_ENV === 'production',
    });

    return response;
  } catch (error: any) {
    if (error?.message === 'URSA_REJECTED_CREDENTIALS') {
      return NextResponse.json(
        { error: 'URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่' },
        { status: 401 }
      );
    }

    console.error('[URSA Login Error]:', error?.message || error);
    return NextResponse.json(
      { error: 'ไม่สามารถเชื่อมต่อ URSA ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง' },
      { status: 502 }
    );
  }
}
```

---

### 3.6 API Route: `GET /api/auth/status` (`src/app/api/auth/status/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = getSession(sessionId);

  return NextResponse.json(
    { connected: Boolean(session) },
    {
      status: 200,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  );
}
```

---

### 3.7 API Route: `POST /api/auth/logout` (`src/app/api/auth/logout/route.ts`)

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { deleteSession, SESSION_COOKIE_NAME } from '@/lib/ursa/sessionStore';

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (sessionId) {
    deleteSession(sessionId);
  }

  const response = NextResponse.json({ ok: true, connected: false }, { status: 200 });

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: '',
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });

  return response;
}

export async function GET(request: NextRequest) {
  return POST(request);
}
```

---

## 4. Edge Cases & Boundary Handling

| # | Edge Case / Scenario | Mechanism in M1 | Result |
|---|----------------------|-----------------|--------|
| 1 | Empty / Whitespace Username or Password | Checked in `POST /api/auth/login` | HTTP 400 `{ error: "username and password are required" }` |
| 2 | Invalid Credentials (Bad password/username) | Regex check `/Access Denied\|User name.*Password/i` against decoded Windows-874 HTML | HTTP 401 `{ error: "URSA ปฏิเสธ username หรือ password กรุณาตรวจสอบแล้วลองใหม่" }` |
| 3 | Network Error / URSA Down | Caught by outer `try/catch` in login route | HTTP 502 `{ error: "ไม่สามารถเชื่อมต่อ URSA ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง" }` |
| 4 | Redirect Loop (> 5 Hops) | Loop capped at `MAX_REDIRECT_HOPS = 5` | Exits loop safely and inspects response |
| 5 | Expired Session (> 1 Hour) | `getSession()` checks `Date.now() - session.createdAt > 3600000` | Auto-deletes and returns `null` (`connected: false`) |
| 6 | Hot Module Reload in Next.js Dev | `globalForUrsa.ursaSessions` singleton pattern | Sessions remain active across source file edits during dev |
| 7 | Duplicate Cookie Keys from Upstream | `mergeCookies` key-value Map deduplication | Preserves most recent value for each key |

---

## 5. File Manifest for Milestone 1

| Path | Action | Description |
|------|--------|-------------|
| `src/types/ursa.ts` | Create | Complete URSA TypeScript interfaces & enums |
| `src/lib/ursa/sessionStore.ts` | Create | In-memory session store with TTL & crypto IDs |
| `src/lib/ursa/decoder.ts` | Create | Windows-874 buffer & response decoding utility |
| `src/lib/ursa/client.ts` | Create | Upstream URSA HTTP client & redirect follower |
| `src/app/api/auth/login/route.ts` | Create | Login route handler |
| `src/app/api/auth/status/route.ts` | Create | Auth status route handler |
| `src/app/api/auth/logout/route.ts` | Create | Logout route handler |

---

## 6. Worker Execution Checklist

- [ ] Create `src/types/ursa.ts`
- [ ] Create `src/lib/ursa/sessionStore.ts`
- [ ] Create `src/lib/ursa/decoder.ts`
- [ ] Create `src/lib/ursa/client.ts`
- [ ] Create `src/app/api/auth/login/route.ts`
- [ ] Create `src/app/api/auth/status/route.ts`
- [ ] Create `src/app/api/auth/logout/route.ts`
- [ ] Verify `npm run build` succeeds with zero TypeScript / lint errors.
