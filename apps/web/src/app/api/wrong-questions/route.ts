import {
  getAuthUser,
  fetchWrongQuestionList,
  submitWrongQuestionReview,
  FetchNotFoundErr,
} from '@ai-study/core';
import { NextResponse } from 'next/server';

/** 错题列表：查询已下沉至 core/learning/queries.ts。 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const questions = await fetchWrongQuestionList(user.id);
    return NextResponse.json({ questions });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}

/** 错题复习（SM-2 自评）：逻辑已下沉至 core/learning/queries.ts。 */
export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { id, quality } = body as { id?: unknown; quality?: unknown };
  if (!id || typeof quality !== 'number' || quality < 0 || quality > 5) {
    return NextResponse.json({ error: '无效参数' }, { status: 400 });
  }

  try {
    const result = await submitWrongQuestionReview(user.id, String(id), quality);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof FetchNotFoundErr) {
      return NextResponse.json({ error: err.message }, { status: 404 });
    }
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
