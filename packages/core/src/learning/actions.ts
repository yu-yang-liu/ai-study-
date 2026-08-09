import { composeMessages } from '../ai/prompt/compose';
import { structuredCall } from '../ai/structured/call';
import { TASK_SCHEMA } from '../ai/structured/schemas';
import { blocksToPlainText, sanitizeBlocks } from '../ai/structured/blocks';
import { retrieveReferences } from '../ai/rag';
import { getLearnerContext } from '../ai/learner/context';
import type { AnalyzeOutput, GradeMathOutput, GradeEssayOutput, PlanOutput, Block } from '../ai/structured/schemas';
import { getServiceClient } from '../db';
import { APP_PHASE } from '../constants';
import { persistAnalyzeResult, persistPlanResult, persistGradeResult } from './persist';

export type GradeQuestionType = 'math' | 'essay';

/**
 * 批改兜底判定阈值：当 AI 未显式返回 isCorrect 时，按得分率 ≥ 此值判定为正确。
 * 影响是否写入 wrong_questions 与 SM-2 复习链路。
 * 注：此为「及格即掌握」的简化口径；后续若需按题型/学科细分，可改造为映射表。
 */
export const GRADE_PASS_RATIO = 0.6;

export type GradeResult = {
  score: number;
  maxScore: number;
  isCorrect?: boolean;
  summary: string;
  steps?: Array<{ stepNumber: number; isCorrect: boolean; feedback: string }>;
  /** 公式块（M1 公式渲染）：存在时 iOS 优先渲染 blocks，缺省回退 summary string。由 executeGrade 从模型输出透传。 */
  summaryBlocks?: Block[];
  stepsBlocks?: Array<{ stepNumber: number; feedbackBlocks?: Block[] }>;
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

  // M-D：几何 visual block 校验——非法 geometry 降级为占位，不影响整响应。
  if (result.answerBlocks) result.answerBlocks = sanitizeBlocks(result.answerBlocks);
  if (result.analysisBlocks) result.analysisBlocks = sanitizeBlocks(result.analysisBlocks);
  if (result.examPointsBlocks) result.examPointsBlocks = sanitizeBlocks(result.examPointsBlocks);

  // B 策略派生回填：模型只输出 *Blocks，这里派生同名 string 字段。
  // string 字段供 persist(TEXT 列)/RAG/chat 模板/Web 等字符串消费者使用，blocks 供 iOS 公式渲染。
  if (result.analysisBlocks && !result.analysis) {
    result.analysis = blocksToPlainText(result.analysisBlocks) || result.analysis;
  }
  if (result.answerBlocks) {
    result.answer = result.answer ?? blocksToPlainText(result.answerBlocks);
  }
  if (result.examPointsBlocks) {
    result.examPoints = result.examPoints ?? blocksToPlainText(result.examPointsBlocks);
  }

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

  // B 策略派生回填（仅 gradeMath 有 blocks 字段；essay 不动）。
  if (task === 'gradeMath') {
    const math = result as GradeMathOutput;
    if (math.summaryBlocks) math.summaryBlocks = sanitizeBlocks(math.summaryBlocks);
    if (math.steps) {
      for (const step of math.steps) {
        if (step.feedbackBlocks) step.feedbackBlocks = sanitizeBlocks(step.feedbackBlocks);
      }
    }
    if (math.summaryBlocks && !math.summary) {
      math.summary = blocksToPlainText(math.summaryBlocks) || math.summary;
    }
    if (math.steps) {
      for (const step of math.steps) {
        if (step.feedbackBlocks && !step.feedback) {
          step.feedback = blocksToPlainText(step.feedbackBlocks) || step.feedback;
        }
      }
    }
  }

  const gradeResult: GradeResult = {
    score: result.score,
    maxScore: result.maxScore,
    summary: result.summary,
    isCorrect: 'isCorrect' in result ? result.isCorrect : undefined,
    steps: 'steps' in result ? result.steps : undefined,
    // 透传 blocks 供 API 响应携带，iOS 优先渲染。
    summaryBlocks: 'summaryBlocks' in result ? (result as GradeMathOutput).summaryBlocks : undefined,
    stepsBlocks:
      'steps' in result
        ? (result as GradeMathOutput).steps.map((s) => ({
            stepNumber: s.stepNumber,
            feedbackBlocks: s.feedbackBlocks,
          }))
        : undefined,
  };

  const isCorrect = gradeResult.isCorrect ?? gradeResult.score >= gradeResult.maxScore * GRADE_PASS_RATIO;

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
  const supabase = getServiceClient();

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
  const supabase = getServiceClient();
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
