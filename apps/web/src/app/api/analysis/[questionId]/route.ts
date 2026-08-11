import { APP_PHASE, getAuthUser, getServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bookmarkSchema = z.object({ isFavorite: z.boolean() });

export async function PATCH(
  request: Request,
  context: { params: Promise<{ questionId: string }> },
) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { questionId } = await context.params;
  const parsed = bookmarkSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { error } = await getServiceClient()
    .from('question_analysis')
    .update({ is_favorite: parsed.data.isFavorite })
    .eq('question_id', questionId)
    .eq('user_id', user.id)
    .eq('phase', APP_PHASE);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, isFavorite: parsed.data.isFavorite });
}
