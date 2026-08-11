import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { executeGrade, GRADE_PASS_RATIO } from './actions';
import { updateKnowledgeMastery } from './mastery';

export type BankQuestionItem = {
  id: string;
  subject: string;
  year: number | null;
  topic: string | null;
  examPoint: string | null;
  questionType: string | null;
  content: string;
  options: string[];
  difficulty: number | null;
  source: string | null;
};

export type BankQuestionFilters = {
  subject?: string;
  year?: number;
  questionType?: string;
  difficulty?: number;
  limit?: number;
  offset?: number;
};

export type BankFilterOptions = {
  subjects: string[];
  years: number[];
  questionTypes: string[];
  difficulties: number[];
};

export type BankQuestionList = {
  questions: BankQuestionItem[];
  total: number;
  filters: BankFilterOptions;
};

export type BankPracticeResult = {
  practiceRecordId: string;
  questionId: string;
  isCorrect: boolean;
  score: number;
  maxScore: number;
  correctAnswer: string;
  analysis: string;
  examPoint: string | null;
};

type BankRow = {
  id: string;
  subject: string;
  year: number | null;
  topic: string | null;
  exam_point: string | null;
  question_type: string | null;
  content: string;
  options: unknown;
  answer?: string | null;
  analysis?: string | null;
  source: string | null;
  difficulty: number | null;
};

function parseOptions(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
}

function mapQuestion(row: BankRow): BankQuestionItem {
  return {
    id: row.id,
    subject: row.subject,
    year: row.year ?? null,
    topic: row.topic ?? null,
    examPoint: row.exam_point ?? null,
    questionType: row.question_type ?? null,
    content: row.content,
    options: parseOptions(row.options),
    difficulty: row.difficulty ?? null,
    source: row.source ?? null,
  };
}

function uniqueSorted(values: Array<string | number>): Array<string | number> {
  return [...new Set(values)].sort((a, b) => String(a).localeCompare(String(b), 'zh-CN', { numeric: true }));
}

async function fetchFilterOptions(): Promise<BankFilterOptions> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('question_bank')
    .select('subject, year, question_type, difficulty')
    .eq('phase', APP_PHASE);

  if (error) throw new Error(`fetchBankFilterOptions: ${error.message}`);

  const rows = (data ?? []) as Array<{
    subject: string;
    year: number | null;
    question_type: string | null;
    difficulty: number | null;
  }>;

  return {
    subjects: uniqueSorted(rows.map((row) => row.subject)) as string[],
    years: (uniqueSorted(rows.flatMap((row) => (row.year == null ? [] : [row.year]))) as number[]).sort(
      (a, b) => b - a,
    ),
    questionTypes: uniqueSorted(
      rows.flatMap((row) => (row.question_type ? [row.question_type] : [])),
    ) as string[],
    difficulties: (uniqueSorted(
      rows.flatMap((row) => (row.difficulty == null ? [] : [row.difficulty])),
    ) as number[]).sort((a, b) => a - b),
  };
}

export async function fetchBankQuestions(filters: BankQuestionFilters = {}): Promise<BankQuestionList> {
  const supabase = getServiceClient();
  const limit = Math.min(Math.max(filters.limit ?? 20, 1), 50);
  const offset = Math.max(filters.offset ?? 0, 0);

  let query = supabase
    .from('question_bank')
    .select('id, subject, year, topic, exam_point, question_type, content, options, source, difficulty', {
      count: 'exact',
    })
    .eq('phase', APP_PHASE)
    .order('year', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.subject) query = query.eq('subject', filters.subject);
  if (filters.year) query = query.eq('year', filters.year);
  if (filters.questionType) query = query.eq('question_type', filters.questionType);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);

  const [{ data, count, error }, filterOptions] = await Promise.all([query, fetchFilterOptions()]);
  if (error) throw new Error(`fetchBankQuestions: ${error.message}`);

  return {
    questions: ((data ?? []) as BankRow[]).map(mapQuestion),
    total: count ?? 0,
    filters: filterOptions,
  };
}

export class BankQuestionNotFoundError extends Error {
  constructor(id: string) {
    super(`Question not found: ${id}`);
    this.name = 'BankQuestionNotFoundError';
  }
}

type ExistingPracticeRow = {
  id: string;
  question_id: string;
  is_correct: boolean;
  score: number | string | null;
  max_score: number | string | null;
  ai_feedback: string | null;
};

async function restoreExistingPractice(
  userId: string,
  clientRequestId: string,
): Promise<BankPracticeResult | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('practice_records')
    .select('id, question_id, is_correct, score, max_score, ai_feedback')
    .eq('user_id', userId)
    .eq('client_request_id', clientRequestId)
    .maybeSingle();

  if (error) throw new Error(`restoreBankPractice: ${error.message}`);
  if (!data) return null;

  const row = data as ExistingPracticeRow;
  const { data: analysis, error: analysisError } = await supabase
    .from('question_analysis')
    .select('answer, analysis, exam_points')
    .eq('question_id', row.question_id)
    .maybeSingle();

  if (analysisError) throw new Error(`restoreBankPractice analysis: ${analysisError.message}`);

  return {
    practiceRecordId: row.id,
    questionId: row.question_id,
    isCorrect: row.is_correct,
    score: Number(row.score ?? 0),
    maxScore: Number(row.max_score ?? 100),
    correctAnswer: analysis?.answer ?? '',
    analysis: row.ai_feedback ?? analysis?.analysis ?? '',
    examPoint: analysis?.exam_points ?? null,
  };
}

async function fetchBankQuestionForPractice(id: string): Promise<BankRow & { answer: string; analysis: string }> {
  const supabase = getServiceClient();
  const { data, error } = await supabase
    .from('question_bank')
    .select(
      'id, subject, year, topic, exam_point, question_type, content, options, answer, analysis, source, difficulty',
    )
    .eq('id', id)
    .eq('phase', APP_PHASE)
    .maybeSingle();

  if (error) throw new Error(`fetchBankQuestion: ${error.message}`);
  if (!data) throw new BankQuestionNotFoundError(id);

  const row = data as BankRow;
  return {
    ...row,
    answer: row.answer ?? '',
    analysis: row.analysis ?? '',
  };
}

export function normalizeBankAnswer(value: string): string {
  return value
    .normalize('NFKC')
    .toLocaleLowerCase('zh-CN')
    .replace(/^(答案|我的答案)\s*[:：]\s*/u, '')
    .replace(/[“”"'‘’`]/g, '')
    .replace(/\s+/g, '')
    .replace(/[。．.!！?？；;，,、]+$/u, '');
}

export function bankAnswersMatch(expected: string, actual: string): boolean {
  const normalizedExpected = normalizeBankAnswer(expected);
  const normalizedActual = normalizeBankAnswer(actual);
  if (!normalizedExpected || !normalizedActual) return false;
  if (normalizedExpected === normalizedActual) return true;

  const splitAnswers = (value: string): string[] =>
    value
    .split(/[\/／|｜,，、;；]|或|或者/u)
    .map((item) => item.trim())
    .filter(Boolean);
  const alternatives = splitAnswers(normalizedExpected);
  if (alternatives.includes(normalizedActual)) return true;

  const selectedChoice = normalizedActual.match(/^([a-z])(?:[.)、:：])/u)?.[1];
  if (selectedChoice && alternatives.includes(selectedChoice)) return true;

  if (alternatives.length > 1) {
    const selectedAnswers = splitAnswers(normalizedActual);
    return selectedAnswers.length === alternatives.length
      && selectedAnswers.every((item) => alternatives.includes(item));
  }
  return false;
}

export async function submitBankPractice(
  userId: string,
  input: {
    questionId: string;
    userAnswer: string;
    durationSec?: number;
    clientRequestId?: string;
  },
): Promise<BankPracticeResult> {
  const userAnswer = input.userAnswer.trim();
  if (!userAnswer) throw new Error('userAnswer is required');

  if (input.clientRequestId) {
    const existing = await restoreExistingPractice(userId, input.clientRequestId);
    if (existing) return existing;
  }

  const bankQuestion = await fetchBankQuestionForPractice(input.questionId);
  const isSubjective = /简答|计算|证明|作文/u.test(bankQuestion.question_type ?? '');
  let isCorrect: boolean;
  let score = 0;
  let maxScore = 100;
  let feedback = bankQuestion.analysis;

  if (isSubjective) {
    const gradeResult = await executeGrade({
      userId,
      subject: bankQuestion.subject,
      questionType: bankQuestion.question_type === '作文' ? 'essay' : 'math',
      questionContent: bankQuestion.content,
      studentAnswer: userAnswer,
      persist: false,
    });
    score = gradeResult.score;
    maxScore = gradeResult.maxScore;
    isCorrect = gradeResult.isCorrect ?? score >= maxScore * GRADE_PASS_RATIO;
    feedback = feedback || gradeResult.summary;
  } else {
    isCorrect = bankAnswersMatch(bankQuestion.answer, userAnswer);
    score = isCorrect ? 100 : 0;
  }

  const knowledgePoints = [bankQuestion.topic, bankQuestion.exam_point].filter(
    (value): value is string => Boolean(value),
  );
  const supabase = getServiceClient();

  const { data: question, error: questionError } = await supabase
    .from('questions')
    .insert({
      user_id: userId,
      phase: APP_PHASE,
      subject: bankQuestion.subject,
      content: bankQuestion.content,
      source: `question_bank:${bankQuestion.id}`,
    })
    .select('id')
    .single();
  if (questionError || !question) {
    throw new Error(`submitBankPractice questions: ${questionError?.message ?? 'no row'}`);
  }

  const { error: analysisError } = await supabase.from('question_analysis').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    subject: bankQuestion.subject,
    topic: bankQuestion.topic,
    question_type: bankQuestion.question_type,
    knowledge_points: knowledgePoints,
    difficulty: bankQuestion.difficulty,
    answer: bankQuestion.answer,
    analysis: bankQuestion.analysis,
    exam_points: bankQuestion.exam_point,
  });
  if (analysisError) throw new Error(`submitBankPractice question_analysis: ${analysisError.message}`);

  const { data: practice, error: practiceError } = await supabase
    .from('practice_records')
    .insert({
      user_id: userId,
      phase: APP_PHASE,
      question_id: question.id,
      is_correct: isCorrect,
      score,
      max_score: maxScore,
      user_answer: userAnswer,
      ai_feedback: feedback || null,
      duration_sec: input.durationSec ?? null,
      client_request_id: input.clientRequestId ?? null,
    })
    .select('id')
    .single();
  if (practiceError || !practice) {
    if (input.clientRequestId) {
      const existing = await restoreExistingPractice(userId, input.clientRequestId);
      if (existing) return existing;
    }
    throw new Error(`submitBankPractice practice_records: ${practiceError?.message ?? 'no row'}`);
  }

  if (!isCorrect) {
    const { error: wrongError } = await supabase.from('wrong_questions').insert({
      user_id: userId,
      phase: APP_PHASE,
      question_id: question.id,
      knowledge_points: knowledgePoints,
      review_count: 0,
      ease_factor: 2.5,
      interval_days: 1,
    });
    if (wrongError) throw new Error(`submitBankPractice wrong_questions: ${wrongError.message}`);
  }

  const { error: eventError } = await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'practice',
    subject: bankQuestion.subject,
    knowledge_points: knowledgePoints,
    is_correct: isCorrect,
    score,
    max_score: maxScore,
    duration_sec: input.durationSec ?? null,
  });
  if (eventError) throw new Error(`submitBankPractice learning_events: ${eventError.message}`);

  try {
    await updateKnowledgeMastery(
      userId,
      bankQuestion.subject,
      knowledgePoints,
      isCorrect ? 'correct' : 'incorrect',
    );
  } catch (error) {
    console.warn('submitBankPractice mastery update failed:', error);
  }

  return {
    practiceRecordId: practice.id,
    questionId: question.id,
    isCorrect,
    score,
    maxScore,
    correctAnswer: bankQuestion.answer,
    analysis: feedback,
    examPoint: bankQuestion.exam_point,
  };
}
