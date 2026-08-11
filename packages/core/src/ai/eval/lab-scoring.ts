import {
  labBlockSchema,
  normalizeLabOutput,
  type LabBlock,
  type LabOutputRaw,
} from '../structured/schemas';

export const LAB_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'apparatus', weight: 2.0 },
  { name: 'connections', weight: 1.5 },
  { name: 'labels', weight: 0.5 },
];

export const LAB_CASE_PASS_THRESHOLD = 0.7;

export interface LabDimension {
  name: string;
  weight: number;
  score: number;
}

export function scoreLab(output: LabOutputRaw | null, expected: LabBlock | null): LabDimension[] {
  const scores: Record<string, number> = { validity: 0, nullCase: 0, apparatus: 0, connections: 0, labels: 0 };

  const normalized = normalizeLabOutput(output);
  const actual = normalized.lab ?? null;
  const valid = actual === null || labBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    const structural = actual === null ? 1 : 0;
    for (const name of ['apparatus', 'connections', 'labels']) scores[name] = structural;
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;

  // 器材：type 多重集召回（不要求 id/坐标一一对应）
  const expTypes = new Map<string, number>();
  const actTypes = new Map<string, number>();
  for (const item of expected.apparatus) {
    expTypes.set(item.type, (expTypes.get(item.type) ?? 0) + 1);
  }
  for (const item of actual.apparatus) {
    actTypes.set(item.type, (actTypes.get(item.type) ?? 0) + 1);
  }
  let matchedTypes = 0;
  let totalTypes = 0;
  for (const [type, count] of expTypes) {
    totalTypes += count;
    matchedTypes += Math.min(count, actTypes.get(type) ?? 0);
  }
  scores.apparatus = totalTypes === 0 ? 1 : matchedTypes / totalTypes;

  // 连接：fromType→toType（含 kind）多重集匹配
  const actTypeOf = (id: string) => actual.apparatus.find((a) => a.id === id)?.type ?? 'other';
  const actConnections = new Map<string, number>();
  for (const conn of actual.connections) {
    const key = `${actTypeOf(conn.from)}->${actTypeOf(conn.to)}:${conn.kind ?? 'tube'}`;
    actConnections.set(key, (actConnections.get(key) ?? 0) + 1);
  }
  const expTypeOf = (id: string) => expected.apparatus.find((a) => a.id === id)?.type ?? 'other';
  let matchedConnections = 0;
  let totalConnections = 0;
  for (const conn of expected.connections) {
    const key = `${expTypeOf(conn.from)}->${expTypeOf(conn.to)}:${conn.kind ?? 'tube'}`;
    totalConnections++;
    const count = actConnections.get(key) ?? 0;
    if (count > 0) {
      actConnections.set(key, count - 1);
      matchedConnections++;
    }
  }
  scores.connections = totalConnections === 0 ? 1 : matchedConnections / totalConnections;

  // 标注：label + content 文本召回
  const expTexts = new Set(
    expected.apparatus.flatMap((a) => [a.label, a.content].filter((v): v is string => Boolean(v))),
  );
  const actTexts = new Set(
    actual.apparatus.flatMap((a) => [a.label, a.content].filter((v): v is string => Boolean(v))),
  );
  const matchedTexts = [...expTexts].filter((text) => actTexts.has(text)).length;
  scores.labels = expTexts.size === 0 ? 1 : matchedTexts / expTexts.size;

  return toDimensions(scores);
}

export function labOverallScore(dimensions: LabDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

export function labCasePassed(overall: number): boolean {
  return overall >= LAB_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): LabDimension[] {
  return LAB_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}
