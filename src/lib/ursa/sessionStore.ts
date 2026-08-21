import crypto from 'node:crypto';
import { UrsaSession } from '@/types/ursa';

export const SESSION_COOKIE_NAME = 'buplaner_session';
export const SESSION_TTL_MS = 60 * 60 * 1000; // 1 hour (3,600,000 ms)

// Preserve session map across Hot Module Reloading (HMR) in development
const globalForUrsa = globalThis as unknown as {
  ursaSessions?: Map<string, UrsaSession>;
};

export const sessionMap = globalForUrsa.ursaSessions ?? new Map<string, UrsaSession>();

if (process.env.NODE_ENV !== 'production') {
  globalForUrsa.ursaSessions = sessionMap;
}

/**
 * Creates a new URSA session with a cryptographically secure base64url token.
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
 * Retrieves an active, unexpired session for the provided session token.
 * Automatically deletes and returns null if the session has expired.
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
 * Deletes a session by token from the in-memory store.
 */
export function deleteSession(sessionId: string | null | undefined): boolean {
  if (!sessionId) return false;
  return sessionMap.delete(sessionId);
}

/**
 * Sweeps and purges all expired sessions from the store.
 */
export function cleanupExpiredSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessionMap.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessionMap.delete(id);
    }
  }
}
