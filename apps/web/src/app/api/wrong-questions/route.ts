import { getAuthUser, createServiceClient, sm2Update, updateKnowledgeMastery } from '@ai-study/core';
import { NextResponse } from 'next/server';

type AnalysisRef = { answer: string | null } | { answer: string | null }[] | null;

type WrongRow = {
  id: string;
  knowledge_points: string[] | null;
  review_count: number;
  ease_factor: string | number;
  interval_days: number;
  next_review_at: string;
  questions:
    | { subject: string; content: string; question_analysis: AnalysisRef }
    | { subject: string; content: string; question_analysis: AnalysisRef }[]
    | null;
  practice_records:
    | Array<{ user_answer: string | null; created_at: string }>
    | { user_answer: string | null; created_at: string }
    | null;
};

function unwrap<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function latestAnswer(records: WrongRow['practice_records']): string {
  if (!records) return '';
  const list = Array.isArray(records) ? records : [records];
  const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted[0]?.user_answer ?? '';
}

function correctAnswerFromQuestion(q: WrongRow['questions']): string {
  const question = unwrap(q);
  if (!question) return '';
  const analysis = unwrap(question.question_analysis);
  return analysis?.answer ?? '';
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('wrong_questions')
    .select(
      `id, knowledge_points, review_count, ease_factor, interval_days, next_review_at,
       questions ( subject, content, question_analysis ( answer ) ),
       practice_records ( user_answer, created_at )`,
    )
    .eq('user_id', user.id)
    .eq('mastered', false)
    .order('next_review_at', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const questions = ((data ?? []) as WrongRow[]).map((row) => {
    const q = unwrap(row.questions);
    const kps = row.knowledge_points ?? [];
    return {
      id: row.id,
      questionContent: q?.content ?? '',
      studentAnswer: latestAnswer(row.practice_records),
      correctAnswer: correctAnswerFromQuestion(row.questions),
      subject: q?.subject ?? '\u672a\u77e5',
      knowledgePoint: kps[0] ?? '',
      createdAt: row.next_review_at,
      nextReviewAt: row.next_review_at,
      sm2_interval: row.review_count,
      sm2_ease: Number(row.ease_factor),
    };
  });

  return NextResponse.json({ questions });
}

export async function POST(request: Request) {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id, quality } = await request.json();
  if (!id || typeof quality !== 'number' || quality < 0 || quality > 5) {
    return NextResponse.json({ error: '\u65e0\u6548\u53c2\u6570' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: row, error: fetchErr } = await supabase
    .from('wrong_questions')
    .select('id, review_count, ease_factor, interval_days, knowledge_points, questions ( subject )')
    .eq('id', id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr || !row) {
    return NextResponse.json({ error: fetchErr?.message ?? 'Not found' }, { status: 404 });
  }

  const next = sm2Update(
    {
      easeFactor: Number(row.ease_factor),
      intervalDays: row.interval_days,
      reviewCount: row.review_count,
    },
    quality,
  );

  const now = new Date();
  const nextReview = new Date(now);
  nextReview.setDate(nextReview.getDate() + next.intervalDays);

  const mastered = quality === 5 && next.reviewCount >= 2;

  const { error } = await supabase
    .from('wrong_questions')
    .update({
      review_count: next.reviewCount,
      ease_factor: next.easeFactor,
      interval_days: next.intervalDays,
      next_review_at: nextReview.toISOString(),
      last_reviewed_at: now.toISOString(),
      mastered,
      updated_at: now.toISOString(),
    })
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabase.from('learning_events').insert({
    user_id: user.id,
    phase: 'high',
    type: 'review',
    subject: '\u590d\u4e60',
    duration_sec: 0,
  });

  type ReviewRow = {
    knowledge_points: string[] | null;
    questions: { subject: string } | { subject: string }[] | null;
  };
  const reviewRow = row as ReviewRow;
  const q = Array.isArray(reviewRow.questions)
    ? reviewRow.questions[0]
    : reviewRow.questions;
  const subject = q?.subject ?? '\u672a\u77e5';
  try {
    await updateKnowledgeMastery(
      user.id,
      subject,
      reviewRow.knowledge_points ?? [],
      'review',
      quality,
    );
  } catch (err) {
    console.warn('review mastery update failed:', err);
  }

  return NextResponse.json({ ok: true, mastered });
}
