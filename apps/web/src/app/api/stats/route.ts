import { getAuthUser, fetchStats } from '@ai-study/core';
import { NextResponse } from 'next/server';

/** 学习统计仪表盘：聚合查询已下沉至 core/learning/queries.ts。 */
export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const stats = await fetchStats(user.id);
    return NextResponse.json(stats);
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
