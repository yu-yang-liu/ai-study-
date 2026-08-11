import { APP_PHASE, getAuthUser, getServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';

type RelatedQuestion = {
  subject: string;
  content: string;
  question_analysis?: { question_type: string | null }[] | { question_type: string | null } | null;
};

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await getServiceClient()
    .from('practice_records')
    .select('id, score, max_score, user_answer, created_at, questions(subject, content, question_analysis(question_type))')
    .eq('user_id', user.id)
    .eq('phase', APP_PHASE)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const records = (data ?? []).map((row: any) => {
    const question = Array.isArray(row.questions) ? row.questions[0] : (row.questions as RelatedQuestion | null);
    const analysis = question?.question_analysis;
    const questionType = Array.isArray(analysis) ? analysis[0]?.question_type : analysis?.question_type;
    return {
      id: row.id,
      subject: question?.subject ?? '未知',
      questionType: questionType ?? null,
      questionContent: question?.content ?? '',
      studentAnswer: row.user_answer ?? '',
      score: Number(row.score ?? 0),
      maxScore: Number(row.max_score ?? 100),
      resultJSON: null,
      createdAt: row.created_at,
    };
  });

  return NextResponse.json({ records });
}
