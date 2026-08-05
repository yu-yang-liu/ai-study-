import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { cookies, headers } from 'next/headers';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

export interface AuthUser {
  id: string;
  email: string;
}

function extractBearerToken(headerValue: string | null): string | null {
  if (!headerValue?.startsWith('Bearer ')) return null;
  const token = headerValue.slice(7).trim();
  return token || null;
}

/** Resolve user from a Supabase access token (mobile Bearer auth). */
export async function resolveUserFromAccessToken(accessToken: string): Promise<AuthUser | null> {
  const supabase = createClientFromToken(accessToken);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user?.email) return null;
  return { id: user.id, email: user.email };
}

/** Builds a server-side Supabase client from the current cookie store.
 *  The returned client carries the user's JWT and is subject to RLS. */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        },
      },
    },
  );
}

/** Returns the authenticated user, or null. Does NOT redirect.
 *  Supports Cookie (browser) and Authorization: Bearer (iOS). */
export async function getAuthUser(): Promise<AuthUser | null> {
  const headerStore = await headers();
  const bearer = extractBearerToken(headerStore.get('authorization'));
  if (bearer) {
    return resolveUserFromAccessToken(bearer);
  }

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.email ? { id: user.id, email: user.email } : null;
}

/** Middleware-compatible auth guard. Redirects pages to /login; API routes get 401 JSON. */
export async function requireAuth(
  req: NextRequest,
): Promise<{ user: AuthUser; response: NextResponse } | NextResponse> {
  const isApi = req.nextUrl.pathname.startsWith('/api/');
  const bearer = extractBearerToken(req.headers.get('authorization'));

  let user: AuthUser | null = null;

  if (bearer) {
    user = await resolveUserFromAccessToken(bearer);
  } else {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll() {
            // No-op in middleware; cookies are set via response
          },
        },
      },
    );

    const {
      data: { user: cookieUser },
    } = await supabase.auth.getUser();

    if (cookieUser?.email) {
      user = { id: cookieUser.id, email: cookieUser.email };
    }
  }

  if (!user) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const loginUrl = new URL('/login', req.url);
    return NextResponse.redirect(loginUrl);
  }

  const response = NextResponse.next();
  response.headers.set('x-user-id', user.id);
  return { user, response };
}

/** Returns true if the user's email is in the configured admin list. */
export function isAdmin(email: string): boolean {
  const admins = (process.env.ADMIN_EMAILS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  return admins.includes(email.toLowerCase());
}

/** Throws if the user is not an admin. Call this inside route handlers (server-only). */
export function requireAdmin(email: string): void {
  if (!isAdmin(email)) {
    throw new Error('Forbidden: admin access required');
  }
}

/** Creates a Supabase client from a raw access token. Used for service-to-service
 *  calls where cookie-based auth isn't available (e.g. webhooks, RAG jobs). */
export function createClientFromToken(accessToken: string) {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${accessToken}` } } },
  );
}
