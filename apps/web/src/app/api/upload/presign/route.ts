import { getAuthUser, checkAIRateLimit, createPresignedUploadUrl } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

const presignSchema = z.object({
  contentType: z.enum(ALLOWED_TYPES),
});

function extForType(contentType: string): string {
  switch (contentType) {
    case 'image/png':
      return 'png';
    case 'image/webp':
      return 'webp';
    case 'image/gif':
      return 'gif';
    default:
      return 'jpg';
  }
}

/** Return a presigned PUT URL for direct client upload to S3. */
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

  const parsed = presignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { contentType } = parsed.data;
  const ext = extForType(contentType);
  const key = `users/${user.id}/ocr/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  try {
    const presigned = await createPresignedUploadUrl(user.id, key, contentType);
    return NextResponse.json(presigned);
  } catch (err) {
    return NextResponse.json({ error: `\u9884\u7b7e\u540d\u5931\u8d25\uff1a${String(err)}` }, { status: 500 });
  }
}
