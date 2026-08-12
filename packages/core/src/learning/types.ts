/**
 * 学习统计 / 错题查询的共享类型与工具函数。
 *
 * 历史上 `stats/route.ts` 与 `wrong-questions/route.ts` 各自重复定义了
 * `unwrap`、本地行类型等。本文件集中这些类型与纯函数，供两个路由与
 * core 查询层（queries.ts）共用，避免漂移。遵循「API 薄、业务在 core」原则。
 */

/** Supabase 嵌套 join 返回的「单行或数组或 null」形态统一解包为单行或 null。 */
export function unwrap<T>(value: T | T[] | null): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

// ── stats 路由相关类型 ──

export type PracticeRow = {
  is_correct: boolean;
  score: string | number | null;
  max_score: string | number | null;
  created_at: string;
  questions: { subject: string } | { subject: string }[] | null;
};

export type SubjectStats = {
  correct: number;
  wrong: number;
  avgScore: number;
  scoreSum: number;
  scoreCount: number;
};

export type StatsResponse = {
  totalQuestions: number;
  totalWrong: number;
  accuracy: number;
  avgScore: number;
  subjectBreakdown: Record<string, { correct: number; wrong: number; avgScore: number }>;
  recentActivity: Array<{ date: string; count: number }>;
  trend: Array<{ date: string; count: number; accuracy: number; avgScore: number }>;
  mastery: Array<{
    knowledgePoint: string;
    subject: string;
    level: number;
    uncertainty: number;
    evidenceCount: number;
    trend: string;
    lastSeen: string;
  }>;
  abilities: Record<string, number>;
  abilityTrend: Array<{ date: string; abilities: Record<string, number> }>;
};

// ── wrong-questions 路由相关类型 ──

export type AnalysisRef = { answer: string | null } | { answer: string | null }[] | null;

export type WrongRow = {
  id: string;
  knowledge_points: string[] | null;
  error_type?: string | null;
  review_count: number;
  ease_factor: string | number;
  interval_days: number;
  next_review_at: string;
  questions:
    | { id: string; subject: string; content: string; question_analysis: DetailedAnalysisRef }
    | { id: string; subject: string; content: string; question_analysis: DetailedAnalysisRef }[]
    | null;
  practice_records:
    | Array<{ user_answer: string | null; created_at: string }>
    | { user_answer: string | null; created_at: string }
    | null;
};

export type DetailedAnalysisRef =
  | {
      answer: string | null;
      analysis?: string | null;
      exam_points?: string | null;
      is_favorite?: boolean;
    }
  | {
      answer: string | null;
      analysis?: string | null;
      exam_points?: string | null;
      is_favorite?: boolean;
    }[]
  | null;

/** 从 practice_records（单行或数组）中取最近一次作答。 */
export function latestAnswer(records: WrongRow['practice_records']): string {
  if (!records) return '';
  const list = Array.isArray(records) ? records : [records];
  const sorted = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return sorted[0]?.user_answer ?? '';
}

/** 从 questions→question_analysis 链中取标准答案。 */
export function correctAnswerFromQuestion(q: WrongRow['questions']): string {
  const question = unwrap(q);
  if (!question) return '';
  const analysis = unwrap(question.question_analysis);
  return analysis?.answer ?? '';
}

export type WrongQuestionItem = {
  id: string;
  questionId: string;
  questionContent: string;
  studentAnswer: string;
  correctAnswer: string;
  subject: string;
  knowledgePoint: string;
  knowledgePoints: string[];
  errorType: string | null;
  analysis: string;
  explanation: string;
  isFavorite: boolean;
  createdAt: string;
  nextReviewAt: string;
  sm2_interval: number;
  sm2_ease: number;
};
