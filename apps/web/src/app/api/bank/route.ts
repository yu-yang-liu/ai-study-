import { fetchBankQuestions, getAuthUser } from '@ai-study/core';
import { NextResponse } from 'next/server';

function optionalPositiveInt(value: string | null): number | undefined {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

/** Authenticated question-bank listing. Answers and analyses are intentionally omitted. */
export async function GET(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = optionalPositiveInt(searchParams.get('year'));
  const difficulty = optionalPositiveInt(searchParams.get('difficulty'));
  const limit = optionalPositiveInt(searchParams.get('limit'));
  const offsetValue = searchParams.get('offset');
  const offset = offsetValue && /^\d+$/.test(offsetValue) ? Number(offsetValue) : undefined;

  try {
    const result = await fetchBankQuestions({
      subject: searchParams.get('subject') || undefined,
      year,
      questionType: searchParams.get('questionType') || undefined,
      difficulty,
      limit,
      offset,
    });
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
