import { composeMessages } from '../ai/prompt/compose';
import { structuredCall } from '../ai/structured/call';
import { TASK_SCHEMA } from '../ai/structured/schemas';
import { retrieveReferences } from '../ai/rag';
import { getLearnerContext } from '../ai/learner/context';
import type { AnalyzeOutput, GradeMathOutput, GradeEssayOutput, PlanOutput } from '../ai/structured/schemas';
import { createServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { persistAnalyzeResult, persistPlanResult } from './persist';
import { updateKnowledgeMastery } from './mastery';

export type GradeQuestionType = 'math' | 'essay';

export type GradeResult = {
  score: number;
  maxScore: number;
  isCorrect?: boolean;
  summary: string;
  steps?: Array<{ stepNumber: number; isCorrect: boolean; feedback: string }>;
};

export interface WrongQuestionSummary {
  total: number;
  items: Array<{ subject: string; preview: string }>;
}

export interface StudySnapshot {
  practiceCount7d: number;
  accuracy7d: number;
  wrongQuestionCount: number;
}

async function persistGradeResult(
  userId: string,
  subject: string,
  questionType: GradeQuestionType,
  questionContent: string,
  studentAnswer: string,
  result: GradeResult,
  isCorrect: boolean,
): Promise<void> {
  const supabase = createServiceClient();

  const { data: question, error: qErr } = await supabase
    .from('questions')
    .insert({
      user_id: userId,
      phase: APP_PHASE,
      subject,
      content: questionContent,
      source: 'grade',
    })
    .select('id')
    .single();

  if (qErr || !question) {
    throw new Error(`grade questions insert: ${qErr?.message ?? 'no row'}`);
  }

  const { error: prErr } = await supabase.from('practice_records').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    is_correct: isCorrect,
    score: result.score,
    max_score: result.maxScore,
    user_answer: studentAnswer,
    ai_feedback: result.summary,
  });
  if (prErr) throw new Error(`grade practice_records insert: ${prErr.message}`);

  const { error: qaErr } = await supabase.from('question_analysis').insert({
    user_id: userId,
    phase: APP_PHASE,
    question_id: question.id,
    subject,
    question_type: questionType === 'math' ? '\u8ba1\u7b97\u9898' : '\u4f5c\u6587',
    knowledge_points: [],
    analysis: result.summary,
  });
  if (qaErr) throw new Error(`grade question_analysis insert: ${qaErr.message}`);

  if (!isCorrect) {
    const { data: existing } = await supabase
      .from('wrong_questions')
      .select('id')
      .eq('user_id', userId)
      .eq('question_id', question.id)
      .eq('mastered', false)
      .maybeSingle();

    if (!existing) {
      const { error: wqErr } = await supabase.from('wrong_questions').insert({
        user_id: userId,
        phase: APP_PHASE,
        question_id: question.id,
        knowledge_points: [],
        review_count: 0,
        ease_factor: 2.5,
        interval_days: 1,
      });
      if (wqErr) throw new Error(`grade wrong_questions insert: ${wqErr.message}`);
    }
  }

  const { error: evErr } = await supabase.from('learning_events').insert({
    user_id: userId,
    phase: APP_PHASE,
    type: 'grade',
    subject,
    is_correct: isCorrect,
    score: result.score,
    max_score: result.maxScore,
  });
  if (evErr) throw new Error(`grade learning_events insert: ${evErr.message}`);

  await updateKnowledgeMastery(userId, subject, [], isCorrect ? 'correct' : 'incorrect');
}

export async function executeAnalyze(opts: {
  userId: string;
  subject: string;
  content?: string;
  imageUrl?: string;
}): Promise<AnalyzeOutput> {
  const { userId, subject, content, imageUrl } = opts;
  const { context: learnerContext } = await getLearnerContext(userId);

  const isImage = Boolean(imageUrl);
  const task = isImage ? ('analyzeImg' as const) : ('analyze' as const);
  const userInput = isImage
    ? `\u8bf7\u5206\u6790\u56fe\u7247\u4e2d\u7684\u8bd5\u9898\u5185\u5bb9\u3002${content ? `\n\u8865\u5145\u8bf4\u660e\uff1a${content}` : ''}`
    : content ?? '';

  const messages = composeMessages({
    task,
    subject,
    phase: 'high',
    userInput,
    learnerContext,
  });

  const result = (await structuredCall({
    task,
    schema: TASK_SCHEMA[task],
    messages,
    imageUrls: imageUrl ? [imageUrl] : undefined,
    userId,
    phase: 'high',
  })) as AnalyzeOutput;

  try {
    await persistAnalyzeResult(userId, { subject, content: content ?? '', imageUrl }, result);
  } catch (persistErr) {
    console.warn('analyze persist failed:', persistErr);
  }

  return result;
}

export async function executeGrade(opts: {
  userId: string;
  subject: string;
  questionType: GradeQuestionType;
  questionContent: string;
  studentAnswer: string;
}): Promise<GradeResult> {
  const { userId, subject, questionType, questionContent, studentAnswer } = opts;
  const task = questionType === 'math' ? ('gradeMath' as const) : ('gradeEssay' as const);

  const [references, { context: learnerContext }] = await Promise.all([
    retrieveReferences({ query: questionContent, subject, phase: 'high', limit: 3 }),
    getLearnerContext(userId),
  ]);

  const userInput = `\u9898\u76ee\uff1a${questionContent}\n\n\u5b66\u751f\u4f5c\u7b54\uff1a${studentAnswer}`;
  const messages = composeMessages({ task, subject, phase: 'high', userInput, references, learnerContext });

  const result = (await structuredCall({
    task,
    schema: TASK_SCHEMA[task],
    messages,
    userId,
    phase: 'high',
  })) as GradeMathOutput | GradeEssayOutput;

  const gradeResult: GradeResult = {
    score: result.score,
    maxScore: result.maxScore,
    summary: result.summary,
    isCorrect: 'isCorrect' in result ? result.isCorrect : undefined,
    steps: 'steps' in result ? result.steps : undefined,
  };

  const isCorrect = gradeResult.isCorrect ?? gradeResult.score >= gradeResult.maxScore * 0.6;

  try {
    await persistGradeResult(userId, subject, questionType, questionContent, studentAnswer, gradeResult, isCorrect);
  } catch (err) {
    console.warn('grade persist failed:', err);
  }

  return gradeResult;
}

export async function executePlan(opts: {
  userId: string;
  subject: string;
  focus?: string;
}): Promise<PlanOutput> {
  const { userId, subject, focus } = opts;
  const { context: learnerContext } = await getLearnerContext(userId);

  const userInput = focus
    ? `\u5b66\u751f\u5e0c\u671b\u91cd\u70b9\u5b66\u4e60\uff1a${focus}\n\u8bf7\u636e\u6b64\u5236\u5b9a\u5b66\u4e60\u8ba1\u5212\u3002`
    : `\u8bf7\u6839\u636e\u5b66\u751f\u7684\u5b66\u60c5\u5206\u6790\u5236\u5b9a\u4e2a\u6027\u5316\u5b66\u4e60\u8ba1\u5212\u3002`;

  const messages = composeMessages({
    task: 'plan',
    subject,
    phase: 'high',
    userInput,
    learnerContext,
  });

  const result = (await structuredCall({
    task: 'plan',
    schema: TASK_SCHEMA.plan,
    messages,
    userId,
    phase: 'high',
  })) as PlanOutput;

  try {
    await persistPlanResult(userId, subject, result);
  } catch (persistErr) {
    console.warn('plan persist failed:', persistErr);
  }

  return result;
}

export async function fetchWrongQuestionSummary(userId: string, limit = 5): Promise<WrongQuestionSummary> {
  const supabase = createServiceClient();

  const { count } = await supabase
    .from('wrong_questions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('phase', APP_PHASE)
    .eq('mastered', false);

  const { data } = await supabase
    .from('wrong_questions')
    .select('questions ( subject, content )')
    .eq('user_id', userId)
    .eq('phase', APP_PHASE)
    .eq('mastered', false)
    .order('next_review_at', { ascending: true })
    .limit(limit);

  const items = (data ?? []).map((row) => {
    const q = row.questions as { subject?: string; content?: string } | { subject?: string; content?: string }[] | null;
    const question = Array.isArray(q) ? q[0] : q;
    const content = question?.content ?? '';
    return {
      subject: question?.subject ?? '\u672a\u77e5',
      preview: content.length > 60 ? `${content.slice(0, 60)}...` : content,
    };
  });

  return { total: count ?? items.length, items };
}

export async function fetchStudySnapshot(userId: string): Promise<StudySnapshot> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [practiceRes, wrongCountRes] = await Promise.all([
    supabase
      .from('practice_records')
      .select('is_correct')
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .gte('created_at', since),
    supabase
      .from('wrong_questions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('phase', APP_PHASE)
      .eq('mastered', false),
  ]);

  const practices = practiceRes.data ?? [];
  const correct = practices.filter((p) => p.is_correct).length;
  const accuracy7d = practices.length > 0 ? Math.round((correct / practices.length) * 100) : 0;

  return {
    practiceCount7d: practices.length,
    accuracy7d,
    wrongQuestionCount: wrongCountRes.count ?? 0,
  };
}
