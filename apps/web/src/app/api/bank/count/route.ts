import { getServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';

/** Public count of high-school question bank entries (no row data exposed). */
export async function GET() {
  const supabase = getServiceClient();
  const { count, error } = await supabase
    .from('question_bank')
    .select('*', { count: 'exact', head: true })
    .eq('phase', 'high');

  if (error) return NextResponse.json({ count: 0 });
  return NextResponse.json({ count: count ?? 0 });
}
