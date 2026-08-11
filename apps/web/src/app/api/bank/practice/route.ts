import {
  BankQuestionNotFoundError,
  getAuthUser,
  submitBankPractice,
} from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  questionId: z.string().uuid(),
  userAnswer: z.string().trim().min(1),
  durationSec: z.number().int().min(0).max(24 * 60 * 60).optional(),
  clientRequestId: z.string().uuid().optional(),
});

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await submitBankPractice(user.id, parsed.data);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof BankQuestionNotFoundError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
