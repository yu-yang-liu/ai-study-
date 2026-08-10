import { chartBlockSchema, type ChartBlock, type ChartOutput } from '../structured/schemas';

/** 打分维度（0–1，加权求和；见 docs/VISUAL_AST_COVERAGE.md P1-1）。 */
export const CHART_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'kind', weight: 1.0 },
  { name: 'categories', weight: 1.0 },
  { name: 'values', weight: 2.0 },
  { name: 'points', weight: 1.5 },
  { name: 'bins', weight: 1.5 },
  { name: 'slices', weight: 1.0 },
];

export const CHART_CASE_PASS_THRESHOLD = 0.7;

export interface ChartDimension {
  name: string;
  weight: number;
  score: number;
}

/** 对 chart task 输出打分（纯函数）。 */
export function scoreChart(output: ChartOutput | null, expected: ChartBlock | null): ChartDimension[] {
  const scores: Record<string, number> = {
    validity: 0,
    nullCase: 0,
    kind: 0,
    categories: 0,
    values: 0,
    points: 0,
    bins: 0,
    slices: 0,
  };

  const actual = output?.chart ?? null;
  const valid = actual === null || chartBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    const structural = actual === null ? 1 : 0;
    for (const name of ['kind', 'categories', 'values', 'points', 'bins', 'slices']) {
      scores[name] = structural;
    }
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;
  scores.kind = actual.kind === expected.kind ? 1 : 0;
  const kindMatches = actual.kind === expected.kind;
  // 数据维度默认满分（不适用视为 N/A 满分），随后按 kind 覆盖适用维度。
  scores.categories = 1;
  scores.values = 1;
  scores.points = 1;
  scores.bins = 1;
  scores.slices = 1;

  switch (expected.kind) {
    case 'bar':
    case 'line': {
      const act = kindMatches && (actual.kind === 'bar' || actual.kind === 'line') ? actual : undefined;
      scores.categories = categoryScore(expected.categories, act?.categories ?? []);
      scores.values = seriesValueScore(expected.series, act?.series ?? []);
      break;
    }
    case 'scatter': {
      const act = kindMatches && actual.kind === 'scatter' ? actual : undefined;
      scores.points = scatterScore(expected.points, act?.points ?? []);
      break;
    }
    case 'histogram': {
      const act = kindMatches && actual.kind === 'histogram' ? actual : undefined;
      scores.bins = binsScore(expected.bins, act?.bins ?? []);
      break;
    }
    case 'pie': {
      const act = kindMatches && actual.kind === 'pie' ? actual : undefined;
      scores.slices = slicesScore(expected.slices, act?.slices ?? []);
      break;
    }
  }

  return toDimensions(scores);
}

export function chartOverallScore(dimensions: ChartDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

export function chartCasePassed(overall: number): boolean {
  return overall >= CHART_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): ChartDimension[] {
  return CHART_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}

function categoryScore(expected: string[], actual: string[]): number {
  if (expected.length === 0) return 1;
  if (actual.length !== expected.length) {
    const matched = expected.filter((c, i) => actual[i] === c).length;
    return matched / expected.length;
  }
  const matched = expected.filter((c, i) => actual[i] === c).length;
  return matched / expected.length;
}

function seriesValueScore(
  expected: Array<{ name?: string; values: number[] }>,
  actual: Array<{ name?: string; values: number[] }>,
): number {
  if (expected.length === 0) return 1;
  let total = 0;
  let count = 0;
  for (let i = 0; i < expected.length; i++) {
    const exp = expected[i];
    const act = actual[i];
    if (!exp) continue;
    count++;
    if (!act) continue;
    const scale = Math.max(...exp.values.map((v) => Math.abs(v)), 1);
    let mae = 0;
    const n = Math.min(exp.values.length, act.values.length);
    for (let k = 0; k < n; k++) {
      mae += Math.abs(exp.values[k]! - act.values[k]!) / scale;
    }
    if (n === 0) {
      total += 0;
      continue;
    }
    mae /= n;
    total += mae <= 0.1 ? 1 : Math.max(0, 1 - (mae - 0.1) / 0.2);
  }
  return count === 0 ? 1 : total / count;
}

function scatterScore(expected: Array<[number, number]>, actual: Array<[number, number]>): number {
  if (expected.length === 0) return 1;
  if (actual.length === 0) return 0;
  const xs = expected.map((p) => p[0]);
  const ys = expected.map((p) => p[1]);
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys), 1);
  let total = 0;
  const used = new Set<number>();
  for (const [ex, ey] of expected) {
    let best = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    for (let i = 0; i < actual.length; i++) {
      if (used.has(i)) continue;
      const [ax, ay] = actual[i]!;
      const d = Math.hypot(ax - ex, ay - ey) / scale;
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      total += best <= 0.05 ? 1 : Math.max(0, 1 - (best - 0.05) / 0.1);
    }
  }
  return total / expected.length;
}

function binsScore(
  expected: Array<{ range: [number, number]; count: number }>,
  actual: Array<{ range: [number, number]; count: number }>,
): number {
  if (expected.length === 0) return 1;
  if (actual.length === 0) return 0;
  const centers = expected.map((b) => (b.range[0] + b.range[1]) / 2);
  const scale = Math.max(...centers) - Math.min(...centers) || 1;
  let total = 0;
  const used = new Set<number>();
  for (const exp of expected) {
    const ec = (exp.range[0] + exp.range[1]) / 2;
    let best = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    for (let i = 0; i < actual.length; i++) {
      if (used.has(i)) continue;
      const act = actual[i]!;
      const ac = (act.range[0] + act.range[1]) / 2;
      const d = Math.abs(ac - ec) / scale;
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      const act = actual[bestIndex]!;
      const countScale = Math.max(exp.count, 1);
      const countErr = Math.abs(act.count - exp.count) / countScale;
      const rangeScore = best <= 0.05 ? 1 : Math.max(0, 1 - (best - 0.05) / 0.1);
      const countScore = countErr <= 0.1 ? 1 : Math.max(0, 1 - (countErr - 0.1) / 0.2);
      total += (rangeScore + countScore) / 2;
    }
  }
  return total / expected.length;
}

function slicesScore(
  expected: Array<{ label: string; value: number }>,
  actual: Array<{ label: string; value: number }>,
): number {
  if (expected.length === 0) return 1;
  if (actual.length === 0) return 0;
  let total = 0;
  let count = 0;
  for (const exp of expected) {
    const act = actual.find((s) => s.label === exp.label);
    count++;
    if (!act) continue;
    const scale = Math.max(Math.abs(exp.value), 1);
    const err = Math.abs(act.value - exp.value) / scale;
    total += err <= 0.1 ? 1 : Math.max(0, 1 - (err - 0.1) / 0.2);
  }
  return count === 0 ? 1 : total / count;
}
