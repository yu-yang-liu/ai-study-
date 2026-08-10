import { graphBlockSchema, type GraphBlock, type GraphOutput } from '../structured/schemas';

export const GRAPH_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'nodes', weight: 2.0 },
  { name: 'edges', weight: 2.0 },
  { name: 'labels', weight: 1.0 },
];

export const GRAPH_CASE_PASS_THRESHOLD = 0.7;

export interface GraphDimension {
  name: string;
  weight: number;
  score: number;
}

export function scoreGraph(output: GraphOutput | null, expected: GraphBlock | null): GraphDimension[] {
  const scores: Record<string, number> = { validity: 0, nullCase: 0, nodes: 0, edges: 0, labels: 0 };

  const actual = output?.graph ?? null;
  const valid = actual === null || graphBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    const structural = actual === null ? 1 : 0;
    for (const name of ['nodes', 'edges', 'labels']) scores[name] = structural;
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;

  // 节点：kind 多重集召回
  const expKinds = new Map<string, number>();
  const actKinds = new Map<string, number>();
  for (const node of expected.nodes) expKinds.set(node.kind ?? 'default', (expKinds.get(node.kind ?? 'default') ?? 0) + 1);
  for (const node of actual.nodes) actKinds.set(node.kind ?? 'default', (actKinds.get(node.kind ?? 'default') ?? 0) + 1);
  let matchedKinds = 0;
  let totalKinds = 0;
  for (const [kind, count] of expKinds) {
    totalKinds += count;
    matchedKinds += Math.min(count, actKinds.get(kind) ?? 0);
  }
  scores.nodes = totalKinds === 0 ? 1 : matchedKinds / totalKinds;

  // 边：有向 kind 对（fromKind→toKind）
  const nodeKind = (id: string) => actual.nodes.find((n) => n.id === id)?.kind ?? 'default';
  const actEdgeKeys = new Map<string, number>();
  for (const edge of actual.edges) {
    const key = `${nodeKind(edge.from)}->${nodeKind(edge.to)}`;
    actEdgeKeys.set(key, (actEdgeKeys.get(key) ?? 0) + 1);
  }
  const expNodeKind = (id: string) => expected.nodes.find((n) => n.id === id)?.kind ?? 'default';
  let matchedEdges = 0;
  let totalEdges = 0;
  for (const edge of expected.edges) {
    const key = `${expNodeKind(edge.from)}->${expNodeKind(edge.to)}`;
    totalEdges++;
    const count = actEdgeKeys.get(key) ?? 0;
    if (count > 0) {
      actEdgeKeys.set(key, count - 1);
      matchedEdges++;
    }
  }
  scores.edges = totalEdges === 0 ? 1 : matchedEdges / totalEdges;

  // 标签：label 文本召回
  const expLabels = new Set(expected.nodes.map((n) => n.label));
  const actLabels = new Set(actual.nodes.map((n) => n.label));
  const matchedLabels = [...expLabels].filter((label) => actLabels.has(label)).length;
  scores.labels = expLabels.size === 0 ? 1 : matchedLabels / expLabels.size;

  return toDimensions(scores);
}

export function graphOverallScore(dimensions: GraphDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

export function graphCasePassed(overall: number): boolean {
  return overall >= GRAPH_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): GraphDimension[] {
  return GRAPH_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}
