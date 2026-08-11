import { APP_PHASE, getAuthUser, getServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const addWrongQuestionSchema = z.object({
  subject: z.string().trim().min(1),
  questionContent: z.string().trim().min(1),
  studentAnswer: z.string().trim().default(''),
  correctAnswer: z.string().trim().default(''),
  knowledgePoints: z.array(z.string().trim().min(1)).max(20).default([]),
  errorType: z.string().trim().max(80).optional().nullable(),
});

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = addWrongQuestionSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  const values = parsed.data;
  const supabase = getServiceClient();

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .insert({
      user_id: user.id,
      phase: APP_PHASE,
      subject: values.subject,
      content: values.questionContent,
      source: 'manual_wrong_question',
    })
    .select('id')
    .single();
  if (questionError || !question) {
    return NextResponse.json({ error: questionError?.message ?? 'Question insert failed' }, { status: 500 });
  }

  const { error: analysisError } = await supabase.from('question_analysis').insert({
    user_id: user.id,
    phase: APP_PHASE,
    question_id: question.id,
    subject: values.subject,
    question_type: 'manual',
    knowledge_points: values.knowledgePoints,
    answer: values.correctAnswer || null,
  });
  if (analysisError) return NextResponse.json({ error: analysisError.message }, { status: 500 });

  const { error: practiceError } = await supabase.from('practice_records').insert({
    user_id: user.id,
    phase: APP_PHASE,
    question_id: question.id,
    is_correct: false,
    score: 0,
    max_score: 100,
    user_answer: values.studentAnswer || null,
    error_type: values.errorType ?? null,
  });
  if (practiceError) return NextResponse.json({ error: practiceError.message }, { status: 500 });

  const { error: wrongError } = await supabase.from('wrong_questions').insert({
    user_id: user.id,
    phase: APP_PHASE,
    question_id: question.id,
    knowledge_points: values.knowledgePoints,
    error_type: values.errorType ?? null,
    review_count: 0,
    ease_factor: 2.5,
    interval_days: 1,
  });
  if (wrongError) return NextResponse.json({ error: wrongError.message }, { status: 500 });

  return NextResponse.json({ ok: true, id: question.id }, { status: 201 });
}
