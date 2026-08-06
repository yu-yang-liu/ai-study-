import {
  getAuthUser,
  checkAIRateLimit,
  executeGrade,
  AIStructuredError,
} from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const gradeSchema = z.object({
  subject: z.string().min(1),
  questionType: z.enum(['math', 'essay']),
  questionContent: z.string().min(10).max(5000),
  studentAnswer: z.string().min(1).max(10000),
});

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
  const parsed = gradeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { subject, questionType, questionContent, studentAnswer } = parsed.data;

  try {
    const result = await executeGrade({
      userId: user.id,
      subject,
      questionType,
      questionContent,
      studentAnswer,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AIStructuredError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
