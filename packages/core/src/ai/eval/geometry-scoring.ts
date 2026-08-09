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

// ── Eval v2：几何等价匹配（平移 / 旋转 / 缩放不变性）──

/** 贪心最近邻匹配的平均距离（b 中每点至多被用一次）。 */
function greedyAvgDistance(a: Array<[number, number]>, b: Array<[number, number]>): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  let total = 0;
  let usedCount = 0;
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
      usedCount++;
    }
  }
  return usedCount === 0 ? Number.POSITIVE_INFINITY : total / usedCount;
}

/** 质心 + RMS 单位化（平移、缩放不变）。 */
function normalizePoints(points: Array<[number, number]>): Array<[number, number]> {
  if (points.length === 0) return [];
  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  cx /= points.length;
  cy /= points.length;
  let sq = 0;
  for (const [x, y] of points) {
    sq += (x - cx) ** 2 + (y - cy) ** 2;
  }
  const rms = Math.sqrt(sq / points.length);
  if (rms < 1e-9) return points.map(() => [0, 0]);
  return points.map(([x, y]) => [(x - cx) / rms, (y - cy) / rms]);
}

function centroidOf(points: Array<[number, number]>): [number, number] {
  let cx = 0;
  let cy = 0;
  for (const [x, y] of points) {
    cx += x;
    cy += y;
  }
  return [cx / points.length, cy / points.length];
}

/** 仅平移对齐（质心归零）后的平均距离，绝对单位。 */
function translationDistance(a: Array<[number, number]>, b: Array<[number, number]>): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  const [ax, ay] = centroidOf(a);
  const [bx, by] = centroidOf(b);
  const shiftedA = a.map(([x, y]): [number, number] => [x - ax, y - ay]);
  const shiftedB = b.map(([x, y]): [number, number] => [x - bx, y - by]);
  return greedyAvgDistance(shiftedA, shiftedB);
}

/** Kabsch 2D：把 a 旋转到 b 的最小二乘最佳角度。 */
function bestRotationAngle(a: Array<[number, number]>, b: Array<[number, number]>): number {
  let s = 0;
  let c = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const [ax, ay] = a[i] ?? [0, 0];
    const [bx, by] = b[i] ?? [0, 0];
    s += ax * by - ay * bx;
    c += ax * bx + ay * by;
  }
  return Math.atan2(s, c);
}

function rotatePoints(points: Array<[number, number]>, theta: number): Array<[number, number]> {
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  return points.map(([x, y]) => [x * cos - y * sin, x * sin + y * cos]);
}

/**
 * 相似变换对齐距离：
 * - `allowRotation`：平移 + 缩放 + 旋转（Kabsch）→ 归一化单位；
 * - 否则仅平移对齐 → 绝对单位。
 */
function similarityDistance(
  a: Array<[number, number]>,
  b: Array<[number, number]>,
): number {
  if (a.length === 0 || b.length === 0) return Number.POSITIVE_INFINITY;
  const na = normalizePoints(a);
  const nb = normalizePoints(b);
  if (na.length < 2 || nb.length < 2) {
    return greedyAvgDistance(na, nb);
  }
  // 先用贪心对应建立配对，再求最佳旋转，最后重算对齐距离。
  const pairs: Array<{ a: [number, number]; b: [number, number] }> = [];
  const used = new Set<number>();
  for (const pa of na) {
    let best = Number.POSITIVE_INFINITY;
    let bestIndex = -1;
    for (let i = 0; i < nb.length; i++) {
      if (used.has(i)) continue;
      const pb = nb[i];
      if (!pb) continue;
      const d = Math.hypot(pa[0] - pb[0], pa[1] - pb[1]);
      if (d < best) {
        best = d;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      pairs.push({ a: pa, b: nb[bestIndex]! });
    }
  }
  if (pairs.length < 2) return greedyAvgDistance(na, nb);
  const theta = bestRotationAngle(
    pairs.map((p) => p.a),
    pairs.map((p) => p.b),
  );
  return greedyAvgDistance(rotatePoints(na, theta), nb);
}

/** 相似变换的归一化容差（单位 RMS 下）。 */
const SIMILARITY_TOLERANCE = 0.05;
/** 仅平移对齐的绝对容差（沿用 v1 的 0.5）。 */
const TRANSLATION_TOLERANCE = 0.5;

function distanceToScore(distance: number, tolerance: number): number {
  if (!Number.isFinite(distance)) return 0;
  return distance <= tolerance ? 1 : Math.max(0, 1 - (distance - tolerance) / tolerance);
}

/** 单个元素对的坐标相似度（0–1）。 */
function elementSimilarity(exp: GeometryElement, act: GeometryElement): number {
  if (exp.type === 'circle' || exp.type === 'arc') {
    // 圆心整体平移等价；半径按比例比较（缩放等价）。
    const expRadius = exp.radius;
    const actRadius = (act as { radius?: number }).radius ?? 0;
    const radiusRatio = Math.abs(expRadius - actRadius) / Math.max(expRadius, actRadius);
    return radiusRatio <= 0.08 ? 1 : Math.max(0, 1 - (radiusRatio - 0.08) / 0.2);
  }
  const expPoints = pointsOf(exp);
  const actPoints = pointsOf(act);
  if (expPoints.length === 0 || actPoints.length === 0) return 0;
  if (exp.type === 'vector') {
    // 方向与模长是物理语义：仅平移对齐，不做缩放/旋转。
    return distanceToScore(translationDistance(expPoints, actPoints), TRANSLATION_TOLERANCE);
  }
  return distanceToScore(similarityDistance(expPoints, actPoints), SIMILARITY_TOLERANCE);
}

function coordinateScore(expected: GeometryElement[], actual: GeometryElement[]): number {
  let total = 0;
  let count = 0;
  const used = new Set<number>();
  for (const exp of expected) {
    if (exp.type === 'label' || exp.type === 'functionCurve') continue;
    let bestIndex = -1;
    let bestScore = Number.NEGATIVE_INFINITY;
    for (let i = 0; i < actual.length; i++) {
      const act = actual[i];
      if (!act || act.type !== exp.type || used.has(i)) continue;
      const score = elementSimilarity(exp, act);
      if (score > bestScore) {
        bestScore = score;
        bestIndex = i;
      }
    }
    if (bestIndex >= 0) {
      used.add(bestIndex);
      total += bestScore;
      count++;
    }
  }
  return count === 0 ? 1 : total / count;
}

function angleScore(expected: GeometryElement[], actual: GeometryElement[]): number {
  type AngleElement = Extract<GeometryElement, { type: 'angle' }>;
  const exp = expected.filter((e): e is AngleElement => e.type === 'angle' && e.degrees !== undefined);
  const act = actual.filter((e): e is AngleElement => e.type === 'angle' && e.degrees !== undefined);
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
  type CurveElement = Extract<GeometryElement, { type: 'functionCurve' }>;
  const exp = expected.filter((e): e is CurveElement => e.type === 'functionCurve');
  const act = actual.filter((e): e is CurveElement => e.type === 'functionCurve');
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
      if (e.type === 'label') return e.text ? [e.text] : [];
      return e.label ? [e.label] : [];
    });
  const expectedLabels = collect(expected);
  if (expectedLabels.length === 0) return 1;
  const actualLabels = new Set(collect(actual));
  return expectedLabels.filter((label) => actualLabels.has(label)).length / expectedLabels.length;
}
