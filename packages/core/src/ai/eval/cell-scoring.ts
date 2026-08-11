import {
  cellBlockSchema,
  normalizeCellOutput,
  type CellBlock,
  type CellOutputRaw,
} from '../structured/schemas';

export const CELL_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'cellType', weight: 0.5 },
  { name: 'organelles', weight: 2.0 },
  { name: 'connections', weight: 1.0 },
  { name: 'transport', weight: 1.0 },
  { name: 'labels', weight: 0.5 },
];

export const CELL_CASE_PASS_THRESHOLD = 0.7;

export interface CellDimension {
  name: string;
  weight: number;
  score: number;
}

export function scoreCell(output: CellOutputRaw | null, expected: CellBlock | null): CellDimension[] {
  const scores: Record<string, number> = {
    validity: 0,
    nullCase: 0,
    cellType: 0,
    organelles: 0,
    connections: 0,
    transport: 0,
    labels: 0,
  };

  const normalized = normalizeCellOutput(output);
  const actual = normalized.cell ?? null;
  const valid = actual === null || cellBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    const structural = actual === null ? 1 : 0;
    for (const name of ['cellType', 'organelles', 'connections', 'transport', 'labels']) {
      scores[name] = structural;
    }
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;
  scores.cellType = actual.cellType === expected.cellType ? 1 : 0;

  // 细胞器：type 多重集召回（不要求 id/坐标一一对应）。
  const expTypes = new Map<string, number>();
  const actTypes = new Map<string, number>();
  for (const item of expected.organelles) {
    expTypes.set(item.type, (expTypes.get(item.type) ?? 0) + 1);
  }
  for (const item of actual.organelles) {
    actTypes.set(item.type, (actTypes.get(item.type) ?? 0) + 1);
  }
  let matchedTypes = 0;
  let totalTypes = 0;
  for (const [type, count] of expTypes) {
    totalTypes += count;
    matchedTypes += Math.min(count, actTypes.get(type) ?? 0);
  }
  scores.organelles = totalTypes === 0 ? 1 : matchedTypes / totalTypes;

  // 细胞器间连接：fromType→toType（含 kind）多重集匹配。
  const actTypeOf = (id: string) => actual.organelles.find((o) => o.id === id)?.type ?? 'other';
  const actConnections = new Map<string, number>();
  for (const conn of actual.connections ?? []) {
    const key = `${actTypeOf(conn.from)}->${actTypeOf(conn.to)}:${conn.kind ?? 'flow'}`;
    actConnections.set(key, (actConnections.get(key) ?? 0) + 1);
  }
  const expTypeOf = (id: string) => expected.organelles.find((o) => o.id === id)?.type ?? 'other';
  let matchedConnections = 0;
  let totalConnections = 0;
  for (const conn of expected.connections ?? []) {
    const key = `${expTypeOf(conn.from)}->${expTypeOf(conn.to)}:${conn.kind ?? 'flow'}`;
    totalConnections++;
    const count = actConnections.get(key) ?? 0;
    if (count > 0) {
      actConnections.set(key, count - 1);
      matchedConnections++;
    }
  }
  scores.connections = totalConnections === 0 ? 1 : matchedConnections / totalConnections;

  // 跨膜运输：substance→kind:direction 多重集匹配。
  const actTransport = new Map<string, number>();
  for (const item of actual.transport ?? []) {
    const key = `${item.substance}->${item.kind}:${item.direction}`;
    actTransport.set(key, (actTransport.get(key) ?? 0) + 1);
  }
  let matchedTransport = 0;
  let totalTransport = 0;
  for (const item of expected.transport ?? []) {
    const key = `${item.substance}->${item.kind}:${item.direction}`;
    totalTransport++;
    const count = actTransport.get(key) ?? 0;
    if (count > 0) {
      actTransport.set(key, count - 1);
      matchedTransport++;
    }
  }
  scores.transport = totalTransport === 0 ? 1 : matchedTransport / totalTransport;

  // 标注：label + content 文本召回。
  const expTexts = new Set(
    expected.organelles.flatMap((o) => [o.label, o.content].filter((v): v is string => Boolean(v))),
  );
  const actTexts = new Set(
    actual.organelles.flatMap((o) => [o.label, o.content].filter((v): v is string => Boolean(v))),
  );
  const matchedTexts = [...expTexts].filter((text) => actTexts.has(text)).length;
  scores.labels = expTexts.size === 0 ? 1 : matchedTexts / expTexts.size;

  return toDimensions(scores);
}

export function cellOverallScore(dimensions: CellDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

export function cellCasePassed(overall: number): boolean {
  return overall >= CELL_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): CellDimension[] {
  return CELL_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}
