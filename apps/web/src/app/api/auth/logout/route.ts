import { createServerAuthClient } from '@ai-study/core';
import { NextResponse } from 'next/server';

export async function POST() {
  const authClient = await createServerAuthClient();
  const { error } = await authClient.auth.signOut();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ message: '已登出' });
}
