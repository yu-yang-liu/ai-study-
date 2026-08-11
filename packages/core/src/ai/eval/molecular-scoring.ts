import {
  molecularBlockSchema,
  normalizeMolecularOutput,
  type MolecularBlock,
  type MolecularOutputRaw,
} from '../structured/schemas';

export const MOLECULAR_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2 },
  { name: 'nullCase', weight: 1 },
  { name: 'atomSymbols', weight: 2 },
  { name: 'atomCount', weight: 1 },
  { name: 'bonds', weight: 2 },
  { name: 'labels', weight: 0.5 },
];

export const MOLECULAR_CASE_PASS_THRESHOLD = 0.7;

export interface MolecularDimension {
  name: string;
  weight: number;
  score: number;
}

export function scoreMolecular(
  output: MolecularOutputRaw | null,
  expected: MolecularBlock | null,
): MolecularDimension[] {
  const scores: Record<string, number> = {
    validity: 0,
    nullCase: 0,
    atomSymbols: 0,
    atomCount: 0,
    bonds: 0,
    labels: 0,
  };

  const actual = normalizeMolecularOutput(output).molecular;
  const valid = actual === null || molecularBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    const isNull = actual === null;
    scores.nullCase = isNull ? 1 : 0;
    for (const name of ['atomSymbols', 'atomCount', 'bonds', 'labels']) scores[name] = isNull ? 1 : 0;
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;
  scores.atomCount = scoreRatio(expected.atoms.length, actual.atoms.length);

  const expectedSymbols = countSymbols(expected);
  const actualSymbols = countSymbols(actual);
  const totalAtoms = Math.max(expected.atoms.length, 1);
  const matchedSymbols = [...expectedSymbols].reduce(
    (sum, [symbol, count]) => sum + Math.min(count, actualSymbols.get(symbol) ?? 0),
    0,
  );
  scores.atomSymbols = matchedSymbols / totalAtoms;

  scores.bonds = scoreBonds(expected, actual);

  const expectedLabels = expected.atoms.filter((atom) => atom.label).map((atom) => atom.label!);
  const actualLabels = new Set(actual.atoms.flatMap((atom) => (atom.label ? [atom.label] : [])));
  scores.labels =
    expectedLabels.length === 0
      ? 1
      : expectedLabels.filter((label) => actualLabels.has(label)).length / expectedLabels.length;

  return toDimensions(scores);
}

export function molecularOverallScore(dimensions: MolecularDimension[]): number {
  const totalWeight = dimensions.reduce((sum, dimension) => sum + dimension.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, dimension) => sum + dimension.weight * dimension.score, 0) / totalWeight;
}

export function molecularCasePassed(overall: number): boolean {
  return overall >= MOLECULAR_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): MolecularDimension[] {
  return MOLECULAR_DIMENSIONS.map(({ name, weight }) => ({
    name,
    weight,
    score: scores[name] ?? 0,
  }));
}

function countSymbols(block: MolecularBlock): Map<string, number> {
  const counts = new Map<string, number>();
  for (const atom of block.atoms) counts.set(atom.symbol, (counts.get(atom.symbol) ?? 0) + 1);
  return counts;
}

function scoreRatio(expected: number, actual: number): number {
  if (expected === actual) return 1;
  return Math.max(0, 1 - Math.abs(actual - expected) / Math.max(expected, 1));
}

function scoreBonds(expected: MolecularBlock, actual: MolecularBlock): number {
  if (expected.bonds.length === 0) return actual.bonds.length === 0 ? 1 : 0;
  const expectedPairs = new Set(
    expected.bonds.map((bond) => `${[bond.from, bond.to].sort().join('-')}:${bond.order}`),
  );
  const actualPairs = new Set(
    actual.bonds.map((bond) => `${[bond.from, bond.to].sort().join('-')}:${bond.order}`),
  );
  const matched = [...expectedPairs].filter((bond) => actualPairs.has(bond)).length;
  return matched / expectedPairs.size;
}
