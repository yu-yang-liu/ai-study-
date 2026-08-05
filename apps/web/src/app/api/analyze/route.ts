import {
  getAuthUser,
  checkAIRateLimit,
  AIStructuredError,
  executeAnalyze,
} from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const analyzeSchema = z
  .object({
    content: z.string().max(5000).optional(),
    imageUrl: z.string().url().optional(),
    subject: z.string().min(1),
  })
  .refine((d) => (d.content && d.content.length >= 10) || d.imageUrl, {
    message: 'Provide content (min 10 chars) or imageUrl',
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

  const parsed = analyzeSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { content, imageUrl, subject } = parsed.data;

  try {
    const result = await executeAnalyze({
      userId: user.id,
      subject,
      content,
      imageUrl,
    });
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof AIStructuredError) {
      return NextResponse.json({ error: err.message }, { status: 422 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
