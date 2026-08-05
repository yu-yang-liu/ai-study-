import { createServerSupabaseClient, AUTH_RATE_LIMIT, checkRateLimit, bootstrapUserRecords } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`auth:login:${ip}`, AUTH_RATE_LIMIT.maxRequests, AUTH_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) } },
    );
  }

  const body = await request.json();
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  if (data.user?.id && data.user.email) {
    try {
      await bootstrapUserRecords(data.user.id, data.user.email);
    } catch (err) {
      console.warn('bootstrapUserRecords failed:', err);
    }
  }

  return NextResponse.json({
    user: { id: data.user.id, email: data.user.email },
    session: {
      access_token: data.session.access_token,
      refresh_token: data.session.refresh_token,
      expires_at: data.session.expires_at,
    },
  });
}
