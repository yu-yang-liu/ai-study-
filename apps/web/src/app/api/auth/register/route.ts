import { createServerAuthClient, AUTH_RATE_LIMIT, checkRateLimit, bootstrapUserRecords } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',').pop()?.trim() ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`auth:register:${ip}`, AUTH_RATE_LIMIT.maxRequests, AUTH_RATE_LIMIT.windowMs);
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
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const email = parsed.data.email.trim().toLowerCase();
  const emailRl = await checkRateLimit(`auth:register:email:${email}`, 5, 3_600_000);
  if (!emailRl.allowed) {
    return NextResponse.json(
      { error: '注册请求过于频繁，请稍后再试' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((emailRl.retryAfterMs ?? 3_600_000) / 1000)) } },
    );
  }

  const authClient = await createServerAuthClient();

  const { data, error } = await authClient.auth.signUp({
    email,
    password: parsed.data.password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user?.id && data.user.email) {
    try {
      await bootstrapUserRecords(data.user.id, data.user.email);
    } catch (err) {
      console.warn('bootstrapUserRecords failed:', err);
    }
  }

  return NextResponse.json({
    user: data.user ? { id: data.user.id, email: data.user.email } : null,
    message: '注册成功。若启用邮箱验证，请查收验证邮件后登录。',
  });
}
