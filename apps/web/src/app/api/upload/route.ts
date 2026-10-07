import { getAuthUser, checkAIRateLimit, uploadFile } from '@ai-study/core';
import { NextResponse } from 'next/server';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const rl = await checkAIRateLimit(user.id);
  if (!rl.allowed) {
    return NextResponse.json({ error: '请求过于频繁' }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: '无效的表单数据' }, { status: 400 });
  }

  const file = formData.get('file');
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: '缺少文件' }, { status: 400 });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: '仅支持 JPG/PNG/WebP/GIF 图片' }, { status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: '文件大小不超过 10MB' }, { status: 400 });
  }

  const ext = file.type === 'image/jpeg' ? 'jpg' : file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'gif';
  const key = `users/${user.id}/ocr/${Date.now()}_${crypto.randomUUID()}.${ext}`;

  const buf = new Uint8Array(await file.arrayBuffer());

  try {
    const url = await uploadFile(user.id, key, buf, file.type);
    return NextResponse.json({ url, key });
  } catch (err) {
    console.error('[api/upload]', err);
    return NextResponse.json({ error: '服务器内部错误，请稍后再试' }, { status: 500 });
  }
}
