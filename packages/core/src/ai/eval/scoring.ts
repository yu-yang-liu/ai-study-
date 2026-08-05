import type { TaskName } from '../gateway/types';
import type { EvalDimension } from './types';

function objVal(obj: unknown, path: string): unknown {
  const parts = path.split('.');
  let current: unknown = obj;
  for (const p of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function scoreNumberMatch(actual: unknown, expected: number, tolerance: number): number {
  if (typeof actual !== 'number') return 0;
  const diff = Math.abs(actual - expected);
  return diff <= tolerance ? 1 : Math.max(0, 1 - diff / (tolerance * 2 || 1));
}

function scoreBooleanMatch(actual: unknown, expected: boolean): number {
  return actual === expected ? 1 : 0;
}

function scoreArrayOverlap(actual: unknown, expected: unknown[]): number {
  if (!Array.isArray(actual)) return 0;
  if (expected.length === 0) return 1;
  const actStr = actual.map((a) => (typeof a === 'string' ? a : JSON.stringify(a)));
  const expStr = expected.map((e) => (typeof e === 'string' ? e : JSON.stringify(e)));
  let matches = 0;
  for (const e of expStr) {
    if (actStr.some((a) => a.includes(e) || e.includes(a))) matches++;
  }
  return matches / expStr.length;
}

function scoreDimensionsEnum(actual: unknown, expected: object): number {
  if (typeof actual !== 'object' || actual === null) return 0;
  const expKeys = Object.keys(expected);
  const actKeys = Object.keys(actual as Record<string, unknown>);
  if (expKeys.length === 0) return 1;
  let matches = 0;
  for (const k of expKeys) {
    if (actKeys.includes(k)) matches++;
  }
  return matches / expKeys.length;
}

/**
 * 按任务类型配置的评估权重�?
 * 权重越高，该维度在总分中的占比越大�?
 * 如果某字段不�?evalWeights 中，默认权重�?1�?
 */
const TASK_EVAL_WEIGHTS: Partial<Record<TaskName, Record<string, number>>> = {
  gradeMath: {
    // 数学批改：最终答案和关键步骤权重最�?
    finalAnswer: 1.5,
    keySteps: 1.2,
    overallScore: 1.0,
    feedback: 0.8,
  },
  gradeEssay: {
    // 作文批改：思想内容和语言表达权重最�?
    思想内容: 1.5,
    语言表达: 1.5,
    结构: 1.0,
    书写规范: 0.8,
    overallScore: 1.0,
    feedback: 0.8,
  },
  analyze: {
    // 题目分析：知识准确性和考点识别最重要
    knowledgePoints: 1.2,
    topic: 1.0,
    difficulty: 0.8,
    answer: 1.5,
    analysis: 1.2,
  },
  plan: {
    // 学习计划：任务合理性和优先级最重要
    tasks: 1.2,
    priorities: 1.0,
    focus: 0.8,
  },
};

/**
 * Computes scoring dimensions by comparing actual AI output against expected values.
 * Dimensions are weighted per task type (see TASK_EVAL_WEIGHTS).
 * Pure function �?no side effects, testable in isolation.
 */
export function computeDimensions(
  actual: unknown,
  expected: Record<string, unknown>,
  tolerances?: Record<string, number>,
  taskWeights?: Record<string, number>,
): EvalDimension[] {
  const entries = Object.entries(expected);

  if (entries.length === 0) {
    return [{ name: 'formatCompliance', weight: 1, score: actual !== null && typeof actual === 'object' ? 1 : 0 }];
  }

  // Calculate raw weights first
  const rawWeights = entries.map(([key]) => taskWeights?.[key] ?? 1);
  const totalWeight = rawWeights.reduce((a, b) => a + b, 0);

  const dimensions: EvalDimension[] = [];

  for (let i = 0; i < entries.length; i++) {
    const [key, expVal] = entries[i]!;
    const actVal = objVal(actual, key);
    const tol = tolerances?.[key] ?? 0;

    let score: number;
    if (typeof expVal === 'boolean') {
      score = scoreBooleanMatch(actVal, expVal);
    } else if (typeof expVal === 'number') {
      score = scoreNumberMatch(actVal, expVal, tol);
    } else if (Array.isArray(expVal)) {
      score = scoreArrayOverlap(actVal, expVal);
    } else if (typeof expVal === 'object' && expVal !== null) {
      score = scoreDimensionsEnum(actVal, expVal);
    } else {
      const actStr = String(actVal ?? '');
      const expStr = String(expVal);
      score = actStr.includes(expStr) || expStr.includes(actStr) ? 1 : 0;
    }

    const normalizedWeight = totalWeight > 0 ? rawWeights[i]! / totalWeight : 1 / entries.length;
    dimensions.push({ name: key, weight: Math.round(normalizedWeight * 1000) / 1000, score });
  }

  return dimensions;
}

export function getTaskEvalWeights(task: TaskName): Record<string, number> {
  return TASK_EVAL_WEIGHTS[task] ?? {};
}
