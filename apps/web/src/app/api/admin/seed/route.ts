import { getAuthUser, isAdmin, seedAppContent } from '@ai-study/core';
import { NextResponse } from 'next/server';

export async function POST() {
  const user = await getAuthUser();
  if (!user || !isAdmin(user.email)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await seedAppContent(user.email);
  return NextResponse.json({ message: 'Seeded 72 placeholder records (9 subjects × 2 phases × 4 types).' });
}
