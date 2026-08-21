import { UrsaLoginCredentials } from '@/types/ursa';
import { decodeUrsaResponse } from './decoder';

export const URSA_BASE_URL = 'https://ursa2.bu.ac.th';
export const URSA_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
export const MAX_REDIRECT_HOPS = 5;
export const DEFAULT_TIMEOUT_MS = 10000;

/**
 * Validates if the hostname belongs to Bangkok University URSA.
 */
export function isAllowedUrsaHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return host === 'ursa2.bu.ac.th' || host.endsWith('.bu.ac.th');
}

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
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (landingResponse.status >= 500) {
    throw new Error('URSA_UNAVAILABLE');
  }

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
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  if (response.status >= 500) {
    throw new Error('URSA_UNAVAILABLE');
  }

  cookieJar = mergeCookies(cookieJar, extractUpstreamCookies(response));

  // Step 3: Multi-hop redirect following (up to 5 hops)
  for (let hop = 0; hop < MAX_REDIRECT_HOPS && response.status >= 300 && response.status < 400; hop++) {
    const location = response.headers.get('location');
    if (!location) break;

    let nextUrl: URL;
    try {
      nextUrl = new URL(location, URSA_BASE_URL);
    } catch {
      throw new Error('URSA_UNAVAILABLE');
    }

    if (!isAllowedUrsaHost(nextUrl.hostname)) {
      throw new Error('URSA_UNAVAILABLE');
    }

    response = await fetch(nextUrl.toString(), {
      method: 'GET',
      redirect: 'manual',
      headers: {
        'User-Agent': URSA_USER_AGENT,
        'Referer': `${URSA_BASE_URL}/SetFullId.cfm`,
        ...(cookieJar ? { Cookie: cookieJar } : {}),
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (response.status >= 500) {
      throw new Error('URSA_UNAVAILABLE');
    }

    cookieJar = mergeCookies(cookieJar, extractUpstreamCookies(response));
  }

  // Step 4: Verify authentication result
  if (response.status >= 500) {
    throw new Error('URSA_UNAVAILABLE');
  }

  const html = await decodeUrsaResponse(response);

  // Check A: If response page still contains login form or access denied
  const isLoginPage = /inter_passwd|liveid|SetFullId\.cfm|Access Denied|User name.*Password/i.test(html);
  if (isLoginPage) {
    throw new Error('URSA_REJECTED_CREDENTIALS');
  }

  // Check B: Verify session with /remark/remark.cfm to ensure student credentials were truly accepted
  try {
    const checkResp = await fetch(`${URSA_BASE_URL}/remark/remark.cfm`, {
      method: 'GET',
      headers: {
        'User-Agent': URSA_USER_AGENT,
        ...(cookieJar ? { Cookie: cookieJar } : {}),
      },
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    });

    if (checkResp.ok) {
      const checkHtml = await decodeUrsaResponse(checkResp);
      const hasStudentData = /Student\s*ID|รหัสนักศึกษา|Student\s*Code|\b1\d{9}\b/i.test(checkHtml);
      const hasLoginForm = /inter_passwd|liveid|SetFullId\.cfm/i.test(checkHtml);

      if (!hasStudentData || hasLoginForm) {
        throw new Error('URSA_REJECTED_CREDENTIALS');
      }
    }
  } catch (err: any) {
    if (err?.message === 'URSA_REJECTED_CREDENTIALS') {
      throw err;
    }
    // If network error during verification check
    throw new Error('URSA_REJECTED_CREDENTIALS');
  }

  if (!cookieJar) {
    throw new Error('URSA_UNAVAILABLE');
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
    signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });
}

