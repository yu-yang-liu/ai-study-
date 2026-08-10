import { circuitBlockSchema, type CircuitBlock, type CircuitOutput } from '../structured/schemas';

/** 打分维度（0–1，加权求和；见 docs/VISUAL_AST_COVERAGE.md P1-2）。 */
export const CIRCUIT_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'components', weight: 1.5 },
  { name: 'connections', weight: 2.0 },
  { name: 'values', weight: 1.0 },
];

export const CIRCUIT_CASE_PASS_THRESHOLD = 0.7;

export interface CircuitDimension {
  name: string;
  weight: number;
  score: number;
}

/**
 * 对 circuit task 输出打分（纯函数；拓扑匹配：类型多重集 + 无向边类型对）。
 * 局限（v1）：类型对边多重集对「元件相同但连接顺序不同」的拓扑（如三元件
 * 串联 vs 三角并联）不可区分；后续版本可升级为按坐标排序的路径签名。
 */
export function scoreCircuit(output: CircuitOutput | null, expected: CircuitBlock | null): CircuitDimension[] {
  const scores: Record<string, number> = {
    validity: 0,
    nullCase: 0,
    components: 0,
    connections: 0,
    values: 0,
  };

  const actual = output?.circuit ?? null;
  const valid = actual === null || circuitBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    const structural = actual === null ? 1 : 0;
    for (const name of ['components', 'connections', 'values']) scores[name] = structural;
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;
  scores.components = typeRecall(expected.nodes, actual.nodes);
  scores.connections = edgeRecall(expected, actual);
  scores.values = valueRecall(expected.nodes, actual.nodes);

  return toDimensions(scores);
}

export function circuitOverallScore(dimensions: CircuitDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

export function circuitCasePassed(overall: number): boolean {
  return overall >= CIRCUIT_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): CircuitDimension[] {
  return CIRCUIT_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}

function typeRecall(expected: CircuitBlock['nodes'], actual: CircuitBlock['nodes']): number {
  const expCounts = new Map<string, number>();
  const actCounts = new Map<string, number>();
  for (const node of expected) expCounts.set(node.type, (expCounts.get(node.type) ?? 0) + 1);
  for (const node of actual) actCounts.set(node.type, (actCounts.get(node.type) ?? 0) + 1);
  let matched = 0;
  let total = 0;
  for (const [type, count] of expCounts) {
    total += count;
    matched += Math.min(count, actCounts.get(type) ?? 0);
  }
  return total === 0 ? 1 : matched / total;
}

function nodeTypeOf(id: string, nodes: CircuitBlock['nodes']): string {
  return nodes.find((node) => node.id === id)?.type ?? '?';
}

function edgeMultiset(block: CircuitBlock): string[] {
  return block.wires.map((wire) => {
    const a = nodeTypeOf(wire.from, block.nodes);
    const b = nodeTypeOf(wire.to, block.nodes);
    return [a, b].sort().join('-');
  });
}

function edgeRecall(expected: CircuitBlock, actual: CircuitBlock): number {
  const expEdges = edgeMultiset(expected);
  const actEdges = edgeMultiset(actual);
  if (expEdges.length === 0) return 1;
  if (actEdges.length === 0) return 0;
  const actCounts = new Map<string, number>();
  for (const edge of actEdges) actCounts.set(edge, (actCounts.get(edge) ?? 0) + 1);
  let matched = 0;
  for (const edge of expEdges) {
    const count = actCounts.get(edge) ?? 0;
    if (count > 0) {
      actCounts.set(edge, count - 1);
      matched++;
    }
  }
  return matched / expEdges.length;
}

function valueRecall(expected: CircuitBlock['nodes'], actual: CircuitBlock['nodes']): number {
  const expValues = expected.filter((node) => node.value != null && node.value !== '');
  if (expValues.length === 0) return 1;
  const actKeys = new Set(actual.map((node) => `${node.type}:${node.value ?? ''}`));
  const matched = expValues.filter((node) => actKeys.has(`${node.type}:${node.value ?? ''}`)).length;
  return matched / expValues.length;
}
