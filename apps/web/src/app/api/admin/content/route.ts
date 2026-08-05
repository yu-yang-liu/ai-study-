import { getAuthUser, isAdmin, listContent, upsertContent, deleteContent } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const upsertSchema = z.object({
  phase: z.literal('high').default('high'),
  subject: z.string().min(1),
  contentType: z.string().min(1),
  title: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const url = new URL(request.url);
  const phase = 'high' as const;
  const list = await listContent(phase);
  return NextResponse.json(list);
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await request.json();
  const parsed = upsertSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await upsertContent(user.email, parsed.data);
  return NextResponse.json(result, { status: 201 });
}

export async function DELETE(request: Request) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id } = await request.json();
  await deleteContent(user.email, id);
  return NextResponse.json({ ok: true });
}
