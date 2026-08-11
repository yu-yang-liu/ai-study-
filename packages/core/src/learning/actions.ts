import { composeMessages } from '../ai/prompt/compose';
import { structuredCall } from '../ai/structured/call';
import { TASK_SCHEMA, normalizeLabOutput } from '../ai/structured/schemas';
import { blocksToPlainText, sanitizeBlocks } from '../ai/structured/blocks';
import { retrieveReferences } from '../ai/rag';
import { getLearnerContext } from '../ai/learner/context';
import type {
  AnalyzeOutput,
  GradeMathOutput,
  GradeEssayOutput,
  PlanOutput,
  Block,
  GeometryOutput,
  ChartOutput,
  CircuitOutput,
  PedigreeOutput,
  GraphOutput,
  LabOutputRaw,
} from '../ai/structured/schemas';
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
  steps?: Array<{ stepNumber: number; isCorrect: boolean; feedback?: string }>;
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

/** v1 Geometry AST 覆盖的学科（化学分子结构为 graph 布局，排到扩展阶段）。 */
const GEOMETRY_SUBJECTS = new Set(['数学', '物理']);
/** chart task 覆盖的学科与触发关键词（统计类题目）。 */
const CHART_SUBJECTS = new Set(['数学', '地理', '生物']);
const CHART_KEYWORDS = [
  '统计', '频率', '直方图', '平均数', '中位数', '众数', '方差', '标准差',
  '样本', '分布', '占比', '饼图', '柱状图', '折线图', '散点图', '回归', '气温', '数据', '频数',
];
/** circuit task 触发关键词（物理电路题）。 */
const CIRCUIT_KEYWORDS = [
  '电路', '电阻', '电流表', '电压表', '滑动变阻器', '电源', '开关',
  '串联', '并联', '灯泡', '电表', '欧姆', '伏特', '安培', '测电阻', '电动机',
];
/** pedigree task 触发关键词（生物遗传系谱题）。 */
const PEDIGREE_KEYWORDS = [
  '遗传', '系谱', '患病', '家族', '常染色体', '伴X', '伴性', '显性', '隐性', '先证者', '携带者',
];
/** graph task 触发关键词（生物生态系统/食物链网题）。 */
const GRAPH_KEYWORDS = [
  '食物链', '食物网', '生态系统', '能量流动', '捕食', '营养级', '分解者', '生产者', '消费者',
];
/** lab task 触发关键词（化学实验装置题）。 */
const LAB_SUBJECTS = new Set(['化学']);
const LAB_KEYWORDS = [
  '制取', '制气', '装置图', '实验装置', '蒸馏', '冷凝管', '过滤', '滤纸',
  '萃取', '分液', '蒸发', '加热分解', '排水集气', '排空气法', '收集气体',
  '酒精灯', '试管加热', '烧瓶', '锥形瓶', '分液漏斗', '长颈漏斗', '水浴加热', '坩埚',
];

/**
 * M-D：analyze 后置几何检测。
 *
 * 用独立 `geometry` task（已验证 eval 8/8）判断题目是否需要示意图，命中则把
 * 合法 Geometry AST 以 `visual(kind:"geometry")` block 前置进 analysisBlocks。
 * 不直接依赖 analyze 主提示词输出图形（实测不可靠）；失败时静默降级，不影响 analyze 结果。
 */
export async function attachGeometryVisualBlock(opts: {
  subject: string;
  question: string;
  blocks: Block[] | undefined;
}): Promise<Block[] | undefined> {
  if (!GEOMETRY_SUBJECTS.has(opts.subject) || !opts.question.trim()) return opts.blocks;
  try {
    const messages = composeMessages({
      task: 'geometry',
      subject: opts.subject,
      phase: 'high',
      userInput: opts.question,
    });
    const output = (await structuredCall({
      task: 'geometry',
      schema: TASK_SCHEMA.geometry,
      messages,
      phase: 'high',
    })) as GeometryOutput;
    if (!output.geometry) return opts.blocks;
    const visual: Block = { type: 'visual', kind: 'geometry', geometry: output.geometry };
    return [visual, ...(opts.blocks ?? [])];
  } catch (err) {
    console.warn('attachGeometryVisualBlock failed:', err);
    return opts.blocks;
  }
}

/**
 * P1-1：analyze 后置图表检测。
 *
 * 仅对统计类关键词命中的数学/地理/生物文本题调用 `chart` task；命中则把
 * 合法 Chart AST 以 `chart` block 追加到 analysisBlocks 末尾。
 * 失败时静默降级，不影响 analyze 结果。
 */
export async function attachChartBlock(opts: {
  subject: string;
  question: string;
  blocks: Block[] | undefined;
}): Promise<Block[] | undefined> {
  if (!CHART_SUBJECTS.has(opts.subject) || !opts.question.trim()) return opts.blocks;
  if (!CHART_KEYWORDS.some((keyword) => opts.question.includes(keyword))) return opts.blocks;
  try {
    const messages = composeMessages({
      task: 'chart',
      subject: opts.subject,
      phase: 'high',
      userInput: opts.question,
    });
    const output = (await structuredCall({
      task: 'chart',
      schema: TASK_SCHEMA.chart,
      messages,
      phase: 'high',
    })) as ChartOutput;
    if (!output.chart) return opts.blocks;
    return [...(opts.blocks ?? []), output.chart as Block];
  } catch (err) {
    console.warn('attachChartBlock failed:', err);
    return opts.blocks;
  }
}

/**
 * P1-2：analyze 后置电路图检测。
 *
 * 仅对电路关键词命中的物理文本题调用 `circuit` task；命中则把合法 Circuit AST
 * 以 `circuit` block 追加到 analysisBlocks 末尾。失败时静默降级。
 */
export async function attachCircuitBlock(opts: {
  subject: string;
  question: string;
  blocks: Block[] | undefined;
}): Promise<Block[] | undefined> {
  if (opts.subject !== '物理' || !opts.question.trim()) return opts.blocks;
  if (!CIRCUIT_KEYWORDS.some((keyword) => opts.question.includes(keyword))) return opts.blocks;
  try {
    const messages = composeMessages({
      task: 'circuit',
      subject: opts.subject,
      phase: 'high',
      userInput: opts.question,
    });
    const output = (await structuredCall({
      task: 'circuit',
      schema: TASK_SCHEMA.circuit,
      messages,
      phase: 'high',
    })) as CircuitOutput;
    if (!output.circuit) return opts.blocks;
    return [...(opts.blocks ?? []), output.circuit as Block];
  } catch (err) {
    console.warn('attachCircuitBlock failed:', err);
    return opts.blocks;
  }
}

/**
 * P1-4：analyze 后置遗传系谱图检测（生物）。
 * 命中则把合法 Pedigree AST 以 `pedigree` block 追加到 analysisBlocks。失败静默降级。
 */
export async function attachPedigreeBlock(opts: {
  subject: string;
  question: string;
  blocks: Block[] | undefined;
}): Promise<Block[] | undefined> {
  if (opts.subject !== '生物' || !opts.question.trim()) return opts.blocks;
  if (!PEDIGREE_KEYWORDS.some((keyword) => opts.question.includes(keyword))) return opts.blocks;
  try {
    const messages = composeMessages({
      task: 'pedigree',
      subject: opts.subject,
      phase: 'high',
      userInput: opts.question,
    });
    const output = (await structuredCall({
      task: 'pedigree',
      schema: TASK_SCHEMA.pedigree,
      messages,
      phase: 'high',
    })) as PedigreeOutput;
    if (!output.pedigree) return opts.blocks;
    return [...(opts.blocks ?? []), output.pedigree as Block];
  } catch (err) {
    console.warn('attachPedigreeBlock failed:', err);
    return opts.blocks;
  }
}

/**
 * P1-4：analyze 后置食物链/食物网检测（生物）。
 * 命中则把合法 Graph AST 以 `graph` block 追加到 analysisBlocks。失败静默降级。
 */
export async function attachGraphBlock(opts: {
  subject: string;
  question: string;
  blocks: Block[] | undefined;
}): Promise<Block[] | undefined> {
  if (opts.subject !== '生物' || !opts.question.trim()) return opts.blocks;
  if (!GRAPH_KEYWORDS.some((keyword) => opts.question.includes(keyword))) return opts.blocks;
  try {
    const messages = composeMessages({
      task: 'graph',
      subject: opts.subject,
      phase: 'high',
      userInput: opts.question,
    });
    const output = (await structuredCall({
      task: 'graph',
      schema: TASK_SCHEMA.graph,
      messages,
      phase: 'high',
    })) as GraphOutput;
    if (!output.graph) return opts.blocks;
    return [...(opts.blocks ?? []), output.graph as Block];
  } catch (err) {
    console.warn('attachGraphBlock failed:', err);
    return opts.blocks;
  }
}

/**
 * P2-1：analyze 后置化学实验装置图检测（化学）。
 * 命中则把合法 Lab AST 以 `lab` block 追加到 analysisBlocks。失败静默降级。
 */
export async function attachLabBlock(opts: {
  subject: string;
  question: string;
  blocks: Block[] | undefined;
}): Promise<Block[] | undefined> {
  if (!LAB_SUBJECTS.has(opts.subject) || !opts.question.trim()) return opts.blocks;
  if (!LAB_KEYWORDS.some((keyword) => opts.question.includes(keyword))) return opts.blocks;
  try {
    const messages = composeMessages({
      task: 'lab',
      subject: opts.subject,
      phase: 'high',
      userInput: opts.question,
    });
    const output = normalizeLabOutput((await structuredCall({
      task: 'lab',
      schema: TASK_SCHEMA.lab,
      messages,
      phase: 'high',
    })) as LabOutputRaw);
    if (!output.lab) return opts.blocks;
    return [...(opts.blocks ?? []), output.lab as Block];
  } catch (err) {
    console.warn('attachLabBlock failed:', err);
    return opts.blocks;
  }
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

  // M-D：后置几何检测（仅文本题；拍照题待 OCR 文本接入后复用）。
  if (!isImage && content?.trim()) {
    result.analysisBlocks = await attachGeometryVisualBlock({
      subject,
      question: content,
      blocks: result.analysisBlocks,
    });
    result.analysisBlocks = await attachChartBlock({
      subject,
      question: content,
      blocks: result.analysisBlocks,
    });
    result.analysisBlocks = await attachCircuitBlock({
      subject,
      question: content,
      blocks: result.analysisBlocks,
    });
    result.analysisBlocks = await attachPedigreeBlock({
      subject,
      question: content,
      blocks: result.analysisBlocks,
    });
    result.analysisBlocks = await attachGraphBlock({
      subject,
      question: content,
      blocks: result.analysisBlocks,
    });
    result.analysisBlocks = await attachLabBlock({
      subject,
      question: content,
      blocks: result.analysisBlocks,
    });
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
    summary: result.summary ?? '',
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
