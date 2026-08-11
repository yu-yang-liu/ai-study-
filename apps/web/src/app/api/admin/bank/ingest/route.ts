import {
  getAuthUser,
  isAdmin,
  ingestQuestionBankEntries,
  DEMO_BANK_ENTRIES,
} from '@ai-study/core';
import type { BankEntryInput } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const entrySchema = z.object({
  subject: z.string().min(1),
  content: z.string().min(10),
  year: z.number().int().min(1900).max(2200).optional(),
  examPoint: z.string().optional(),
  analysis: z.string().optional(),
  answer: z.string().optional(),
  options: z.array(z.string().min(1)).max(20).optional(),
  questionType: z.string().optional(),
  topic: z.string().optional(),
  source: z.string().optional(),
  difficulty: z.number().int().min(1).max(10).optional(),
});

const bodySchema = z.object({
  entries: z.array(entrySchema).optional(),
  useDemo: z.boolean().optional(),
});

/** Admin-only: ingest question_bank rows with embeddings (requires DASHSCOPE_API_KEY). */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const entries: BankEntryInput[] = parsed.data.useDemo
    ? DEMO_BANK_ENTRIES
    : (parsed.data.entries ?? []);

  if (entries.length === 0) {
    return NextResponse.json(
      { error: 'Provide entries[] or useDemo: true' },
      { status: 400 },
    );
  }

  try {
    const result = await ingestQuestionBankEntries(entries);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
