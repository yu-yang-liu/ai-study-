import { createServerSupabaseClient, AUTH_RATE_LIMIT, checkRateLimit, bootstrapUserRecords } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

function getClientIp(request: Request): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
}

export async function POST(request: Request) {
  const ip = getClientIp(request);
  const rl = await checkRateLimit(`auth:register:${ip}`, AUTH_RATE_LIMIT.maxRequests, AUTH_RATE_LIMIT.windowMs);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.retryAfterMs ?? 1000) / 1000)) } },
    );
  }

  const body = await request.json();
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  const { email, password } = parsed.data;

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
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
    message: '\u6ce8\u518c\u6210\u529f\u3002\u82e5\u542f\u7528\u90ae\u7bb1\u9a8c\u8bc1\uff0c\u8bf7\u67e5\u6536\u9a8c\u8bc1\u90ae\u4ef6\u540e\u767b\u5f55\u3002',
  });
}
