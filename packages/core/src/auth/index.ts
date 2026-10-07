import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getLocalDatabase, getLocalDatabaseClient } from '../db';

const scrypt = promisify(scryptCallback) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

export interface AuthUser {
  id: string;
  email: string;
}

export interface LocalSession {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: AuthUser;
}

const ACCESS_COOKIE = 'ai_study_access_token';
const REFRESH_COOKIE = 'ai_study_refresh_token';
const ACCESS_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000;

type CookieJar = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options?: Record<string, unknown>): void;
  delete?(name: string): void;
};

type LocalAuthResult<T> = { data: T; error: { message: string } | null };

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const digest = (await scrypt(password, salt, 64)).toString('hex');
  return `scrypt$${salt}$${digest}`;
}

async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [, salt, expected] = encoded.split('$');
  if (!salt || !expected) return false;
  const actual = await scrypt(password, salt, 64);
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && timingSafeEqual(actual, expectedBuffer);
}

function userFromRow(row: Record<string, unknown> | undefined): AuthUser | null {
  if (!row || typeof row.id !== 'string' || typeof row.email !== 'string') return null;
  return { id: row.id, email: row.email };
}

function issueSession(user: AuthUser): LocalSession {
  // 顺手清理已过期的旧会话，避免 sessions 表随时间无限增长。
  getLocalDatabase()
    .prepare('DELETE FROM sessions WHERE refresh_expires_at < ?')
    .run(new Date().toISOString());
  const accessToken = randomBytes(32).toString('base64url');
  const refreshToken = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + ACCESS_TTL_MS);
  const refreshExpiresAt = new Date(Date.now() + REFRESH_TTL_MS);
  getLocalDatabase()
    .prepare(
      `INSERT INTO sessions
       (access_token, refresh_token, user_id, expires_at, refresh_expires_at, revoked)
       VALUES (?, ?, ?, ?, ?, 0)`,
    )
    .run(accessToken, refreshToken, user.id, expiresAt.toISOString(), refreshExpiresAt.toISOString());
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Math.floor(expiresAt.getTime() / 1000),
    user,
  };
}

function setCookie(jar: CookieJar | undefined, name: string, value: string, maxAge: number): void {
  jar?.set(name, value, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge,
  });
}

function setSessionCookies(jar: CookieJar | undefined, session: LocalSession): void {
  setCookie(jar, ACCESS_COOKIE, session.access_token, Math.floor(ACCESS_TTL_MS / 1000));
  setCookie(jar, REFRESH_COOKIE, session.refresh_token, Math.floor(REFRESH_TTL_MS / 1000));
}

function clearSessionCookies(jar: CookieJar | undefined): void {
  if (!jar) return;
  if (jar.delete) {
    jar.delete(ACCESS_COOKIE);
    jar.delete(REFRESH_COOKIE);
    return;
  }
  setCookie(jar, ACCESS_COOKIE, '', 0);
  setCookie(jar, REFRESH_COOKIE, '', 0);
}

function findUserByAccessToken(accessToken: string): AuthUser | null {
  const row = getLocalDatabase()
    .prepare(
      `SELECT u.id, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.access_token = ? AND s.revoked = 0 AND s.expires_at > ?`,
    )
    .get(accessToken, new Date().toISOString()) as Record<string, unknown> | undefined;
  return userFromRow(row);
}

function findUserByRefreshToken(refreshToken: string): AuthUser | null {
  const row = getLocalDatabase()
    .prepare(
      `SELECT u.id, u.email
       FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.refresh_token = ? AND s.revoked = 0 AND s.refresh_expires_at > ?`,
    )
    .get(refreshToken, new Date().toISOString()) as Record<string, unknown> | undefined;
  return userFromRow(row);
}

async function signUp(email: string, password: string, jar?: CookieJar): Promise<LocalAuthResult<{ user: AuthUser; session: LocalSession }>> {
  const normalizedEmail = normalizeEmail(email);
  const user: AuthUser = { id: randomUUID(), email: normalizedEmail };
  try {
    getLocalDatabase()
      .prepare('INSERT INTO users (id, email, password_hash) VALUES (?, ?, ?)')
      .run(user.id, user.email, await hashPassword(password));
    const session = issueSession(user);
    setSessionCookies(jar, session);
    return { data: { user, session }, error: null };
  } catch (error) {
    const message = String(error).toLowerCase().includes('unique')
      ? '该邮箱已注册'
      : error instanceof Error
        ? error.message
        : String(error);
    return { data: { user, session: undefined as never }, error: { message } };
  }
}

async function signIn(email: string, password: string, jar?: CookieJar): Promise<LocalAuthResult<{ user: AuthUser; session: LocalSession }>> {
  const row = getLocalDatabase()
    .prepare('SELECT id, email, password_hash FROM users WHERE email = ? COLLATE NOCASE')
    .get(normalizeEmail(email)) as Record<string, unknown> | undefined;
  const user = userFromRow(row);
  if (!user || typeof row?.password_hash !== 'string' || !(await verifyPassword(password, row.password_hash))) {
    return { data: { user: null as never, session: null as never }, error: { message: '邮箱或密码错误' } };
  }
  const session = issueSession(user);
  setSessionCookies(jar, session);
  return { data: { user, session }, error: null };
}

export function refreshLocalSession(refreshToken: string): LocalAuthResult<{ user: AuthUser; session: LocalSession }> {
  const user = findUserByRefreshToken(refreshToken);
  if (!user) {
    return { data: { user: null as never, session: null as never }, error: { message: 'Refresh token 无效或已过期' } };
  }
  getLocalDatabase().prepare('UPDATE sessions SET revoked = 1 WHERE refresh_token = ?').run(refreshToken);
  const session = issueSession(user);
  return { data: { user, session }, error: null };
}

function createLocalAuthClient(jar?: CookieJar, bearerToken?: string) {
  const auth = {
    signUp: async (input: { email: string; password: string; options?: Record<string, unknown> }): Promise<LocalAuthResult<{ user: AuthUser; session: LocalSession }>> =>
      await signUp(input.email, input.password, jar),
    signInWithPassword: async (input: { email: string; password: string }): Promise<LocalAuthResult<{ user: AuthUser; session: LocalSession }>> =>
      await signIn(input.email, input.password, jar),
    signOut: async (): Promise<{ error: { message: string } | null }> => {
      const token = bearerToken ?? jar?.get(ACCESS_COOKIE)?.value;
      if (token) getLocalDatabase().prepare('UPDATE sessions SET revoked = 1 WHERE access_token = ?').run(token);
      clearSessionCookies(jar);
      return { error: null };
    },
    getUser: async (): Promise<LocalAuthResult<{ user: AuthUser | null }>> => {
      const token = bearerToken ?? jar?.get(ACCESS_COOKIE)?.value;
      const user = token ? findUserByAccessToken(token) : null;
      return { data: { user }, error: user ? null : { message: 'Not authenticated' } };
    },
    refreshSession: async (input: { refresh_token: string }): Promise<LocalAuthResult<{ session: LocalSession | null; user: AuthUser | null }>> => {
      const refreshed = refreshLocalSession(input.refresh_token);
      return {
        data: { session: refreshed.error ? null : refreshed.data.session, user: refreshed.error ? null : refreshed.data.user },
        error: refreshed.error,
      };
    },
    exchangeCodeForSession: async (_code?: string): Promise<{ error: { message: string } }> => ({
      error: { message: '本地模式不支持邮箱回调登录，请直接使用邮箱和密码登录' },
    }),
  };
  return { ...getLocalDatabaseClient(), auth };
}

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue?.startsWith('Bearer ')) return null;
  const token = headerValue.slice(7).trim();
  return token || null;
}

/** Resolve a local access token issued by the SQLite auth store. */
export async function resolveUserFromAccessToken(accessToken: string): Promise<AuthUser | null> {
  return findUserByAccessToken(accessToken);
}

/** Creates the local server auth client backed by SQLite and request cookies. */
export async function createServerAuthClient() {
  const cookieStore = await cookies();
  return createLocalAuthClient(cookieStore as unknown as CookieJar);
}

/** Returns the authenticated user from a Bearer token or the local httpOnly cookie. */
export async function getAuthUser(): Promise<AuthUser | null> {
  const headerStore = await headers();
  const bearer = extractBearerToken(headerStore.get('authorization'));
  if (bearer) return resolveUserFromAccessToken(bearer);
  const cookieStore = await cookies();
  return resolveUserFromAccessToken(cookieStore.get(ACCESS_COOKIE)?.value ?? '');
}

/** Middleware-compatible auth guard for local sessions. */
export async function requireAuth(
  req: NextRequest,
): Promise<{ user: AuthUser; response: NextResponse } | NextResponse> {
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const bearer = extractBearerToken(req.headers.get('authorization'));
  const token = bearer ?? req.cookies.get(ACCESS_COOKIE)?.value ?? '';
  const user = await resolveUserFromAccessToken(token);
  if (!user) {
    if (isApi) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    return NextResponse.redirect(new URL('/login', req.url));
  }
  const response = NextResponse.next();
  return { user, response };
}

export function isAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.toLowerCase());
}

export function requireAdmin(email: string): void {
  if (!isAdmin(email)) throw new Error('Forbidden: admin access required');
}

/** Local client used by internal code that previously accepted a Supabase token client. */
export function createClientFromToken(accessToken: string) {
  return createLocalAuthClient(undefined, accessToken);
}

/** Used by the mobile refresh route without exposing the local cookie jar. */
export const LOCAL_AUTH_COOKIE_NAMES = { access: ACCESS_COOKIE, refresh: REFRESH_COOKIE } as const;
