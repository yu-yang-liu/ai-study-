import { APP_PHASE, getAuthUser, getServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const profileSchema = z.object({
  nickname: z.string().trim().max(80).optional().nullable(),
  examDate: z.string().optional().nullable(),
  targetScore: z.number().min(0).max(1000).optional().nullable(),
  notificationsEnabled: z.boolean().optional().nullable(),
  gradeLevel: z.string().trim().max(30).optional().nullable(),
  track: z.string().trim().max(30).optional().nullable(),
  themeMode: z.enum(['system', 'light', 'dark']).optional().nullable(),
});

type ProfilePreferences = {
  examDate?: string | null;
  notificationsEnabled?: boolean | null;
  gradeLevel?: string | null;
  track?: string | null;
  themeMode?: string | null;
};

function preferencesOf(value: unknown): ProfilePreferences {
  return value && typeof value === 'object' ? (value as ProfilePreferences) : {};
}

function toResponse(profile: any, learnerProfile: any) {
  const preferences = preferencesOf(learnerProfile?.preferences);
  return {
    nickname: profile?.display_name ?? null,
    examDate: preferences.examDate ?? null,
    targetScore: learnerProfile?.target_score == null ? null : Number(learnerProfile.target_score),
    notificationsEnabled: preferences.notificationsEnabled ?? true,
    gradeLevel: preferences.gradeLevel ?? null,
    track: preferences.track ?? null,
    themeMode: preferences.themeMode ?? 'system',
  };
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = getServiceClient();
  const [{ data: profile, error: profileError }, { data: learnerProfile, error: learnerError }] =
    await Promise.all([
      supabase.from('profiles').select('display_name').eq('user_id', user.id).maybeSingle(),
      supabase.from('user_profiles').select('target_score, preferences').eq('user_id', user.id).maybeSingle(),
    ]);

  if (profileError || learnerError) {
    return NextResponse.json({ error: profileError?.message ?? learnerError?.message }, { status: 500 });
  }
  return NextResponse.json(toResponse(profile, learnerProfile));
}

export async function PATCH(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = profileSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const values = parsed.data;
  const supabase = getServiceClient();
  const { data: existing, error: existingError } = await supabase
    .from('user_profiles')
    .select('target_score, preferences')
    .eq('user_id', user.id)
    .maybeSingle();
  if (existingError) return NextResponse.json({ error: existingError.message }, { status: 500 });

  const currentPreferences = preferencesOf(existing?.preferences);
  const nextPreferences: ProfilePreferences = {
    ...currentPreferences,
    ...(values.examDate !== undefined ? { examDate: values.examDate } : {}),
    ...(values.notificationsEnabled !== undefined ? { notificationsEnabled: values.notificationsEnabled } : {}),
    ...(values.gradeLevel !== undefined ? { gradeLevel: values.gradeLevel } : {}),
    ...(values.track !== undefined ? { track: values.track } : {}),
    ...(values.themeMode !== undefined ? { themeMode: values.themeMode } : {}),
  };

  const { error: profileError } = await supabase.from('profiles').upsert(
    {
      user_id: user.id,
      phase: APP_PHASE,
      email: user.email,
      ...(values.nickname !== undefined ? { display_name: values.nickname } : {}),
    },
    { onConflict: 'user_id' },
  );
  if (profileError) return NextResponse.json({ error: profileError.message }, { status: 500 });

  const { error: learnerError } = await supabase.from('user_profiles').upsert(
    {
      user_id: user.id,
      phase: APP_PHASE,
      target_score: values.targetScore !== undefined ? values.targetScore : existing?.target_score ?? null,
      preferences: nextPreferences,
    },
    { onConflict: 'user_id' },
  );
  if (learnerError) return NextResponse.json({ error: learnerError.message }, { status: 500 });

  return GET();
}
