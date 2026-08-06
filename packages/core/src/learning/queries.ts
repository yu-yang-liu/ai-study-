import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import {
  unwrap,
  latestAnswer,
  correctAnswerFromQuestion,
  type PracticeRow,
  type SubjectStats,
  type WrongRow,
  type WrongQuestionItem,
  type StatsResponse,
} from './types';

/**
 * 统计仪表盘聚合查询（原 stats/route.ts 内联逻辑下沉）。
 * 取：练习总数、待复习错题数、近 200 条练习（含学科）、近 200 条学习事件，
 * 在内存聚合 subjectBreakdown / accuracy / recentActivity。
 *
 * 返回形状与原 stats GET 响应完全一致，前端契约不变。
 */
export async function fetchStats(userId: string): Promise<StatsResponse> {
  const supabase = getServiceClient();

  const [
    { count: totalQuestions },
    { count: totalWrong },
    { data: practices },
    { data: events },
  ] = await Promise.all([
    supabase
      .from('practice_records')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId),
    supabase
      .from('wrong_questions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('mastered', false),
    supabase
      .from('practice_records')
      .select('is_correct, score, max_score, created_at, questions ( subject )')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('learning_events')
      .select('created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(200),
  ]);

  const subjectBreakdown: Record<string, SubjectStats> = {};
  let scoreSum = 0;
  let scoreCount = 0;
  let correctCount = 0;
  const totalPractice = (practices ?? []).length;

  for (const row of (practices ?? []) as PracticeRow[]) {
    const subj = unwrap(row.questions)?.subject ?? '未知';
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

  return {
    totalQuestions: totalQuestions ?? 0,
    totalWrong: totalWrong ?? 0,
    accuracy,
    avgScore: scoreCount > 0 ? Math.round(scoreSum / scoreCount) : 0,
    subjectBreakdown: breakdown,
    recentActivity,
  };
}

/**
 * 错题列表查询（原 wrong-questions GET 内联逻辑下沉）。
 * join questions / question_analysis / practice_records，组装前端展示项。
 * 返回形状与原 wrong-questions GET 响应的 questions 数组完全一致。
 */
export async function fetchWrongQuestionList(userId: string): Promise<WrongQuestionItem[]> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('wrong_questions')
    .select(
      `id, knowledge_points, review_count, ease_factor, interval_days, next_review_at,
       questions ( subject, content, question_analysis ( answer ) ),
       practice_records ( user_answer, created_at )`,
    )
    .eq('user_id', userId)
    .eq('mastered', false)
    .order('next_review_at', { ascending: true });

  if (error) throw new Error(`fetchWrongQuestionList: ${error.message}`);

  return ((data ?? []) as WrongRow[]).map((row) => {
    const q = unwrap(row.questions);
    const kps = row.knowledge_points ?? [];
    return {
      id: row.id,
      questionContent: q?.content ?? '',
      studentAnswer: latestAnswer(row.practice_records),
      correctAnswer: correctAnswerFromQuestion(row.questions),
      subject: q?.subject ?? '未知',
      knowledgePoint: kps[0] ?? '',
      createdAt: row.next_review_at,
      nextReviewAt: row.next_review_at,
      sm2_interval: row.review_count,
      sm2_ease: Number(row.ease_factor),
    };
  });
}

/**
 * 错题复习 SM-2 提交（原 wrong-questions POST 内联逻辑下沉）。
 * 读取错题行 → sm2Update → 更新 wrong_questions → 写 learning_events → 更新 mastery。
 * 返回 { ok, mastered } 或抛错（由路由层映射状态码）。
 */
export async function submitWrongQuestionReview(
  userId: string,
  id: string,
  quality: number,
): Promise<{ ok: true; mastered: boolean }> {
  // 延迟导入：sm2Update 来自 ai/learner，updateKnowledgeMastery 来自 ./mastery。
  // 动态 import 避免模块加载顺序问题，且这两者本就是运行时才需要的业务逻辑。
  const [{ sm2Update }, { updateKnowledgeMastery }] = await Promise.all([
    import('../ai/learner/sm2'),
    import('./mastery'),
  ]);
  const supabase = getServiceClient();

  const { data: row, error: fetchErr } = await supabase
    .from('wrong_questions')
    .select('id, review_count, ease_factor, interval_days, knowledge_points, questions ( subject )')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();

  if (fetchErr || !row) {
    throw new FetchNotFoundErr(fetchErr?.message ?? 'Not found');
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
    .eq('user_id', userId);

  if (error) throw new Error(`submitWrongQuestionReview update: ${error.message}`);

  try {
    const { error: lErr } = await supabase.from('learning_events').insert({
      user_id: userId,
      phase: APP_PHASE,
      type: 'review',
      subject: '复习',
      duration_sec: 0,
    });
    if (lErr) console.warn('review learning_events insert:', lErr.message);
  } catch (err) {
    console.warn('review learning_events failed:', err);
  }

  type ReviewRow = {
    knowledge_points: string[] | null;
    questions: { subject: string } | { subject: string }[] | null;
  };
  const reviewRow = row as ReviewRow;
  const q = Array.isArray(reviewRow.questions) ? reviewRow.questions[0] : reviewRow.questions;
  const subject = q?.subject ?? '未知';
  try {
    await updateKnowledgeMastery(
      userId,
      subject,
      reviewRow.knowledge_points ?? [],
      'review',
      quality,
    );
  } catch (err) {
    console.warn('review mastery update failed:', err);
  }

  return { ok: true, mastered };
}

/** 用于区分「未找到错题行」的可识别错误，路由层据此返回 404。 */
export class FetchNotFoundErr extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FetchNotFoundErr';
  }
}
