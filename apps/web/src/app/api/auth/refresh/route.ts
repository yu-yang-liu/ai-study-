import { createAnonClient, AUTH_RATE_LIMIT, checkRateLimit } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

/** Supabase session refresh for mobile clients (iOS). */
export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`auth:refresh:${ip}`, AUTH_RATE_LIMIT.maxRequests, AUTH_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const supabase = createAnonClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: parsed.data.refreshToken,
    });

    if (error || !data.session) {
      return NextResponse.json({ error: error?.message ?? 'Refresh failed' }, { status: 401 });
    }

    return NextResponse.json({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresAt: data.session.expires_at,
      user: data.user ? { id: data.user.id, email: data.user.email } : null,
    });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
