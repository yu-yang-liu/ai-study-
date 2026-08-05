import { getAuthUser, createServiceClient } from '@ai-study/core';
import { NextResponse } from 'next/server';

type PracticeRow = {
  is_correct: boolean;
  score: string | number | null;
  max_score: string | number | null;
  created_at: string;
  questions: { subject: string } | { subject: string }[] | null;
};

type SubjectStats = {
  correct: number;
  wrong: number;
  avgScore: number;
  scoreSum: number;
  scoreCount: number;
};

function unwrap<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export async function GET() {
  const user = await getAuthUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();

  const [
    { count: totalQuestions },
    { count: totalWrong },
    { data: practices },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('practice_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id),
    supabase
      .from('wrong_questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('mastered', false),
    supabase
      .from('practice_records')
      .select('is_correct, score, max_score, created_at, questions ( subject )')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('learning_events')
      .select('created_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const subjectBreakdown: Record<string, SubjectStats> = {};
  let scoreSum = 0;
  let scoreCount = 0;
  let correctCount = 0;
  const totalPractice = (practices ?? []).length;

  for (const row of (practices ?? []) as PracticeRow[]) {
    const subj = unwrap(row.questions)?.subject ?? '\u672a\u77e5';
    if (!subjectBreakdown[subj]) {
      subjectBreakdown[subj] = { correct: 0, wrong: 0, avgScore: 0, scoreSum: 0, scoreCount: 0 };
    }
    if (row.is_correct) {
      subjectBreakdown[subj].correct++;
      correctCount++;
    } else {
      subjectBreakdown[subj].wrong++;
    }
    if (row.score != null) {
      const s = Number(row.score);
      const max = Number(row.max_score ?? 100);
      const pct = max > 0 ? (s / max) * 100 : s;
      const stats = subjectBreakdown[subj];
      stats.scoreSum += pct;
      stats.scoreCount++;
      stats.avgScore = Math.round(stats.scoreSum / stats.scoreCount);
      scoreSum += pct;
      scoreCount++;
    }
  }

  const recentMap: Record<string, number> = {};
  for (const ev of events ?? []) {
    const dateKey = new Date(ev.created_at).toISOString().slice(0, 10);
    recentMap[dateKey] = (recentMap[dateKey] ?? 0) + 1;
  }

  const recentActivity = Object.entries(recentMap)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 7)
    .map(([date, count]) => ({ date, count }));

  const accuracy = totalPractice > 0 ? Math.round((correctCount / totalPractice) * 100) : 0;

  const breakdown = Object.fromEntries(
    Object.entries(subjectBreakdown).map(([subj, stats]) => [
      subj,
      { correct: stats.correct, wrong: stats.wrong, avgScore: stats.avgScore },
    ]),
  );

  return NextResponse.json({
    totalQuestions: totalQuestions ?? 0,
    totalWrong: totalWrong ?? 0,
    accuracy,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
    subjectBreakdown: breakdown,
    recentActivity,
  });
}
