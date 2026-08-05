import { getAuthUser, checkAIRateLimit, uploadFile } from '@ai-study/core';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkAIRateLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: '\u8bf7\u6c42\u8fc7\u4e8e\u9891\u7e41' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '\u65e0\u6548\u7684\u8868\u5355\u6570\u636e' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '\u7f3a\u5c11\u6587\u4ef6' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '\u4ec5\u652f\u6301 JPG/PNG/WebP/GIF \u56fe\u7247' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '\u6587\u4ef6\u5927\u5c0f\u4e0d\u8d85\u8fc7 10MB' }, { status: 400 });
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'gif';
  const key = `users/${user.id}/ocr/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buf = new Uint8Array(await file.arrayBuffer());

  try {
    const url = await uploadFile(user.id, key, buf, file.type);
    return NextResponse.json({ url, key });
  } catch (err) {
    return NextResponse.json({ error: `\u4e0a\u4f20\u5931\u8d25\uff1a${String(err)}` }, { status: 500 });
  }
}
