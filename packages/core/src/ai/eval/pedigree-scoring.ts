import { pedigreeBlockSchema, type PedigreeBlock, type PedigreeOutput } from '../structured/schemas';

export const PEDIGREE_DIMENSIONS: Array<{ name: string; weight: number }> = [
  { name: 'validity', weight: 2.0 },
  { name: 'nullCase', weight: 1.0 },
  { name: 'generations', weight: 1.0 },
  { name: 'individuals', weight: 2.0 },
  { name: 'marriages', weight: 1.5 },
  { name: 'proband', weight: 0.5 },
];

export const PEDIGREE_CASE_PASS_THRESHOLD = 0.7;

export interface PedigreeDimension {
  name: string;
  weight: number;
  score: number;
}

/** 个体属性元组（与 id 无关，用于结构匹配）。 */
function individualTuple(
  individual: PedigreeBlock['generations'][number]['individuals'][number],
): string {
  return [
    individual.gender,
    individual.affected === true ? '1' : '0',
    individual.carrier === true ? '1' : '0',
    individual.deceased === true ? '1' : '0',
    individual.proband === true ? '1' : '0',
  ].join('|');
}

export function scorePedigree(
  output: PedigreeOutput | null,
  expected: PedigreeBlock | null,
): PedigreeDimension[] {
  const scores: Record<string, number> = {
    validity: 0,
    nullCase: 0,
    generations: 0,
    individuals: 0,
    marriages: 0,
    proband: 0,
  };

  const actual = output?.pedigree ?? null;
  const valid = actual === null || pedigreeBlockSchema.safeParse(actual).success;
  scores.validity = valid ? 1 : 0;

  if (expected === null) {
    scores.nullCase = actual === null ? 1 : 0;
    const structural = actual === null ? 1 : 0;
    for (const name of ['generations', 'individuals', 'marriages', 'proband']) scores[name] = structural;
    return toDimensions(scores);
  }

  if (actual === null || !valid) return toDimensions(scores);

  scores.nullCase = 1;

  // 代数与每代人数
  const expectedGenCounts = expected.generations.map((g) => g.individuals.length);
  const actualGenCounts = actual.generations.map((g) => g.individuals.length);
  const genMatched = expectedGenCounts.filter((count, i) => actualGenCounts[i] === count).length;
  scores.generations = expectedGenCounts.length === 0 ? 1 : genMatched / expectedGenCounts.length;

  // 个体属性多重集（含 proband）
  const expTuples = new Map<string, number>();
  const actTuples = new Map<string, number>();
  for (const generation of expected.generations) {
    for (const individual of generation.individuals) {
      const key = individualTuple(individual);
      expTuples.set(key, (expTuples.get(key) ?? 0) + 1);
    }
  }
  for (const generation of actual.generations) {
    for (const individual of generation.individuals) {
      const key = individualTuple(individual);
      actTuples.set(key, (actTuples.get(key) ?? 0) + 1);
    }
  }
  let matchedIndividuals = 0;
  let totalIndividuals = 0;
  for (const [key, count] of expTuples) {
    totalIndividuals += count;
    matchedIndividuals += Math.min(count, actTuples.get(key) ?? 0);
  }
  scores.individuals = totalIndividuals === 0 ? 1 : matchedIndividuals / totalIndividuals;

  // 婚姻：配偶属性对（无序）+ 子女数
  const expMarriages = expected.marriages.map((m) => {
    const ids = m.spouses;
    const expAll = expected.generations.flatMap((g) => g.individuals);
    const actAll = actual.generations.flatMap((g) => g.individuals);
    const spouses = ids.map((id) => individualTuple(expAll.find((i) => i.id === id) ?? ({ gender: 'unknown' } as never)));
    return { spouses: spouses.sort().join('|'), childrenCount: m.children?.length ?? 0 };
  });
  const actMarriages = actual.marriages.map((m) => {
    const ids = m.spouses;
    const actAll = actual.generations.flatMap((g) => g.individuals);
    const spouses = ids.map((id) => individualTuple(actAll.find((i) => i.id === id) ?? ({ gender: 'unknown' } as never)));
    return { spouses: spouses.sort().join('|'), childrenCount: m.children?.length ?? 0 };
  });
  if (expMarriages.length === 0) {
    scores.marriages = 1;
  } else if (actMarriages.length === 0) {
    scores.marriages = 0;
  } else {
    const used = new Set<number>();
    let matched = 0;
    for (const exp of expMarriages) {
      const index = actMarriages.findIndex(
        (act, i) => !used.has(i) && act.spouses === exp.spouses && act.childrenCount === exp.childrenCount,
      );
      if (index >= 0) {
        used.add(index);
        matched++;
      }
    }
    scores.marriages = matched / expMarriages.length;
  }

  // 先证者：期望有 proband 时实际必须有
  const expProband = expected.generations.some((g) => g.individuals.some((i) => i.proband === true));
  const actProband = actual.generations.some((g) => g.individuals.some((i) => i.proband === true));
  scores.proband = expProband ? (actProband ? 1 : 0) : 1;

  return toDimensions(scores);
}

export function pedigreeOverallScore(dimensions: PedigreeDimension[]): number {
  const totalWeight = dimensions.reduce((sum, d) => sum + d.weight, 0);
  if (totalWeight <= 0) return 0;
  return dimensions.reduce((sum, d) => sum + d.weight * d.score, 0) / totalWeight;
}

export function pedigreeCasePassed(overall: number): boolean {
  return overall >= PEDIGREE_CASE_PASS_THRESHOLD;
}

function toDimensions(scores: Record<string, number>): PedigreeDimension[] {
  return PEDIGREE_DIMENSIONS.map(({ name, weight }) => ({ name, weight, score: scores[name] ?? 0 }));
}
