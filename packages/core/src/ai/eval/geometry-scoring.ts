import { geometryAstSchema, type GeometryAST, type GeometryElement, type GeometryOutput } from '../structured/schemas';
import { evalExpr } from './geometry-math';

/** 打分维度（0–1，加权求和；见 docs/GEOMETRY_PROMPT_EVAL.md §3.2）。 */
export const GEOMETRY_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'rootType', weight: 1.0 },
  { name: 'elementRecall', weight: 1.2 },
  { name: 'elementPrecision', weight: 0.8 },
  { name: 'coordinate', weight: 1.5 },
  { name: 'angle', weight: 1.0 },
  { name: 'expression', weight: 1.0 },
  { name: 'labels', weight: 0.6 },
];

export const GEOMETRY_CASE_PASS_THRESHOLD = 0.7;

export interface GeometryDimension {
  name: string;
  weight: number;
  score: number;
}

/**
 * 对 geometry task 输出打分（纯函数）。
 *
 * 局限（第一版）：坐标/角度/表达式按同类型元素顺序匹配，不处理整体
 * 平移/旋转/缩放等价；表达式只做采样对比，不做符号等价。
 */
export function scoreGeometry(output: GeometryOutput | null, expected: GeometryAST | null): GeometryDimension[] {
  const scores: Record<string, number> = {
    validity: 0,
    nullCase: 0,
    rootType: 0,
    elementRecall: 0,
    elementPrecision: 0,
    coordinate: 0,
    angle: 0,
    expression: 0,
    labels: 0,
  };

  const actual = output?.geometry ?? null;
  const valid = actual === null || geometryAstSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  // 负例：必须输出 null。
  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    // 负例不需要图形：输出 null 时结构维度视为不适用（满分）；
    // 误输出图形时结构维度全部记 0，避免靠其他维度蒙混过关。
    const structuralScore = actual === null ? 1 : 0;
    for (const name of ['rootType', 'elementRecall', 'elementPrecision', 'coordinate', 'angle', 'expression', 'labels']) {
      scores[name] = structuralScore;
    }
    return toDimensions(scores);
  }

  // 需要图形但未输出 / 非法 → 结构维度 0。
  if (actual === null || !valid) {
    return toDimensions(scores);
  }

  const expectedElements = elementsOf(expected);
  const actualElements = elementsOf(actual);

  scores.nullCase = 1; // 非负例场景下 nullCase 视为满足
  scores.rootType = expected.type === actual.type ? 1 : 0;

  const expectedTypes = new Set(expectedElements.map((e) => e.type));
  const actualTypes = new Set(actualElements.map((e) => e.type));
  scores.elementRecall =
    expectedTypes.size === 0
      ? 1
      : [...expectedTypes].filter((t) => actualTypes.has(t)).length / expectedTypes.size;
  const extra = [...actualTypes].filter((t) => !expectedTypes.has(t)).length;
  scores.elementPrecision = actualTypes.size === 0 ? 1 : 1 - extra / actualTypes.size;

  scores.coordinate = coordinateScore(expectedElements, actualElements);
  scores.angle = angleScore(expectedElements, actualElements);
  scores.expression = expressionScore(expectedElements, actualElements);
  scores.labels = labelsScore(expectedElements, actualElements);

  return toDimensions(scores);
}

/** 加权总分（0–1）。 */
export function geometryOverallScore(dimensions: GeometryDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

/** 单个 case 是否达标。 */
export function geometryCasePassed(overall: number): boolean {
  return overall >= GEOMETRY_CASE_PASS_THRESHOLD;
}

// ── 内部实现 ──

function toDimensions(scores: Record<string, number>): GeometryDimension[] {
  return GEOMETRY_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}

function elementsOf(ast: GeometryAST): GeometryElement[] {
  return ast.type === 'scene' ? ast.elements : ast.children;
}

function pointsOf(element: GeometryElement): Array<[number, number]> {
  switch (element.type) {
    case 'point':
    case 'label':
      return element.x !== undefined && element.y !== undefined ? [[element.x, element.y]] : [];
    case 'line':
    case 'vector':
      return [element.from ?? [], element.to ?? []].filter((p) => p.length >= 2) as Array<[number, number]>;
    case 'triangle':
      return (element.vertices ?? []) as Array<[number, number]>;
    case 'polygon':
      return (element.points ?? []) as Array<[number, number]>;
    case 'circle':
    case 'arc':
      return element.center ? [element.center] : [];
    case 'angle':
      return element.vertex ? [element.vertex] : [];
    default:
      return [];
  }
}

/** 两个元素点集的最小匹配距离（贪心最近邻）。 */
function pointSetDistance(a: Array<[number, number]>, b: Array<[number, number]>): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  let total = 0;
  const used = new Set<number>();
  for (const [ax, ay] of a) {
    let best = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    for (let i = 0; i < b.length; i++) {
      if (used.has(i)) continue;
      const point = b[i];
      if (!point) continue;
      const d = Math.hypot(point[0] - ax, point[1] - ay);
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      total += best;
    }
  }
  return total / a.length;
}

function coordinateScore(expected: GeometryElement[], actual: GeometryElement[]): number {
  let total = 0;
  let count = 0;
  const used = new Set<number>();
  for (const exp of expected) {
    const points = pointsOf(exp);
    if (points.length === 0) continue;
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < actual.length; i++) {
      const act = actual[i];
      if (!act || act.type !== exp.type || used.has(i)) continue;
      const distance = pointSetDistance(points, pointsOf(act));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      total += bestDistance <= 0.5 ? 1 : Math.max(0, 1 - (bestDistance - 0.5));
      count++;
    }
  }
  return count === 0 ? 1 : total / count;
}

function angleScore(expected: GeometryElement[], actual: GeometryElement[]): number {
  const exp = expected.filter((e) => e.type === 'angle' && e.degrees !== undefined);
  const act = actual.filter((e) => e.type === 'angle' && e.degrees !== undefined);
  if (exp.length === 0) return 1;
  if (act.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < exp.length; i++) {
    const diff = Math.abs((exp[i]?.degrees ?? 0) - (act[i % act.length]?.degrees ?? 0));
    total += diff <= 2 ? 1 : Math.max(0, 1 - diff / 4);
  }
  return total / exp.length;
}

function expressionScore(expected: GeometryElement[], actual: GeometryElement[]): number {
  const exp = expected.filter((e) => e.type === 'functionCurve');
  const act = actual.filter((e) => e.type === 'functionCurve');
  if (exp.length === 0) return 1;
  if (act.length === 0) return 0;
  let total = 0;
  for (let i = 0; i < exp.length; i++) {
    const expCurve = exp[i];
    const actCurve = act[i % act.length];
    if (!expCurve || !actCurve) continue;
    const [xMin, xMax] = expCurve.xRange ?? [-5, 5];
    let mae = 0;
    let samples = 0;
    for (let k = 0; k <= 20; k++) {
      const x = xMin + ((xMax - xMin) * k) / 20;
      const expectedY = evalExpr(expCurve.expr ?? '', x);
      const actualY = evalExpr(actCurve.expr ?? '', x);
      if (expectedY === null || actualY === null) continue;
      mae += Math.abs(expectedY - actualY);
      samples++;
    }
    if (samples === 0) continue;
    mae /= samples;
    total += mae <= 0.1 ? 1 : Math.max(0, 1 - mae / 0.5);
  }
  return total / exp.length;
}

function labelsScore(expected: GeometryElement[], actual: GeometryElement[]): number {
  const collect = (elements: GeometryElement[]): string[] =>
    elements.flatMap((e) => {
      if (e.type === 'triangle' || e.type === 'polygon') return e.labels ?? [];
      return e.label ? [e.label] : [];
    });
  const expectedLabels = collect(expected);
  if (expectedLabels.length === 0) return 1;
  const actualLabels = new Set(collect(actual));
  return expectedLabels.filter((label) => actualLabels.has(label)).length / expectedLabels.length;
}
