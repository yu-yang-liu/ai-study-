import { getAuthUser, getLearnerContext } from '@ai-study/core';
import { NextResponse } from 'next/server';

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { model } = await getLearnerContext(user.id);
    return NextResponse.json(model);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
