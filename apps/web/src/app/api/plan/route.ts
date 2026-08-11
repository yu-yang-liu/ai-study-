import { APP_PHASE, getAuthUser, getServiceClient, checkAIRateLimit, executePlan, AIStructuredError } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const planSchema = z.object({
  subject: z.string().min(1),
  focus: z.string().optional(),
});

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getServiceClient()
    .from('study_plans')
    .select('title, description, plan_data, created_at')
    .eq('user_id', user.id)
    .eq('phase', APP_PHASE)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ plan: null });

  const planData = data.plan_data && typeof data.plan_data === 'object' ? data.plan_data : {};
  return NextResponse.json({
    plan: {
      ...(planData as Record<string, unknown>),
      title: data.title,
      description: data.description ?? '',
      createdAt: data.created_at,
    },
  });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkAIRateLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41' }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = planSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { subject, focus } = parsed.data;

  try {
    const result = await executePlan({ userId: user.id, subject, focus });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AIStructuredError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
