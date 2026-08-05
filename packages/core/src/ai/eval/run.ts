import { z } from 'zod';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA } from '../structured/schemas';
import { computeDimensions, getTaskEvalWeights } from './scoring';
import type { EvalCase, EvalResult, EvalReport } from './types';

/**
 * Runs evaluation for a single case.
 */
export async function evalCase(
  ec: EvalCase,
  opts?: { userId?: string; phase?: import('../../constants').AppPhase },
): Promise<EvalResult> {
  const schema = TASK_SCHEMA[ec.task] as z.ZodType<unknown> | undefined;
  if (!schema) {
    throw new Error(`No schema registered for task: ${ec.task}`);
  }

  const start = Date.now();

  let output: unknown;
  try {
    output = await structuredCall({
      task: ec.task,
      schema,
      messages: ec.messages,
      userId: opts?.userId,
      phase: opts?.phase,
    });
  } catch (err) {
    return {
      caseId: ec.id,
      task: ec.task,
      overallScore: 0,
      dimensions: [{ name: 'aiError', weight: 1, score: 0 }],
      output: String(err),
      expected: ec.expected,
      passed: false,
      durationMs: Date.now() - start,
    };
  }

  const taskWeights = getTaskEvalWeights(ec.task);
  const dimensions = computeDimensions(output, ec.expected, ec.tolerances, taskWeights);
  const overallScore = dimensions.reduce((sum, d) => sum + d.weight * d.score, 0);
  const passed = overallScore >= 0.7;

  return {
    caseId: ec.id,
    task: ec.task,
    overallScore: Math.round(overallScore * 100) / 100,
    dimensions,
    output,
    expected: ec.expected,
    passed,
    durationMs: Date.now() - start,
  };
}

/**
 * Runs a full eval suite against a list of cases.
 */
export async function runEval(
  cases: EvalCase[],
  opts?: { userId?: string; phase?: import('../../constants').AppPhase },
): Promise<EvalReport> {
  const results = await Promise.all(cases.map((c) => evalCase(c, opts)));
  const passed = results.filter((r) => r.passed).length;
  const averageScore = results.length > 0
    ? results.reduce((s, r) => s + r.overallScore, 0) / results.length
    : 0;

  return {
    task: (cases[0]?.task ?? 'plan') as EvalReport['task'],
    totalCases: results.length,
    passed,
    failed: results.length - passed,
    averageScore: Math.round(averageScore * 100) / 100,
    cases: results,
  };
}
