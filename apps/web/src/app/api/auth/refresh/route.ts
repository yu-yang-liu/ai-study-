import { createAnonClient } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

/** Supabase session refresh for mobile clients (iOS). */
export async function POST(request: Request) {
  const body = await request.json();
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
