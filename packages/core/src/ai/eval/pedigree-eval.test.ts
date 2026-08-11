import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type PedigreeOutput } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import {
  PEDIGREE_CASE_PASS_THRESHOLD,
  pedigreeCasePassed,
  pedigreeOverallScore,
  scorePedigree,
} from './pedigree-scoring';
import { pedigreeSamples } from './pedigree-samples';

describe('pedigree-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = pedigreeSamples[0]!;
    const dimensions = scorePedigree({ pedigree: sample.expected, reason: 'ok' }, sample.expected);
    expect(pedigreeOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(pedigreeCasePassed(pedigreeOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出系谱被惩罚', () => {
    const negative = pedigreeSamples.find((s) => s.expected === null)!;
    const ok = scorePedigree({ pedigree: null, reason: '概念题' }, negative.expected);
    expect(pedigreeOverallScore(ok)).toBeGreaterThanOrEqual(0.99);
    const bad = scorePedigree({ pedigree: pedigreeSamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(pedigreeOverallScore(bad)).toBeLessThan(PEDIGREE_CASE_PASS_THRESHOLD);
  });

  it('患病状态错误被惩罚', () => {
    const sample = pedigreeSamples[0]!;
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      const proband = wrong.generations.flatMap((g) => g.individuals).find((i) => i.proband);
      if (proband) proband.affected = false;
    }
    const dimensions = scorePedigree({ pedigree: wrong as PedigreeOutput['pedigree'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.individuals).toBeLessThan(1);
  });

  it('婚姻子女数错误被惩罚', () => {
    const sample = pedigreeSamples[0]!;
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      const marriage = wrong.marriages.find((m) => m.spouses.includes('I1'));
      if (marriage) marriage.children = ['II1'];
    }
    const dimensions = scorePedigree({ pedigree: wrong as PedigreeOutput['pedigree'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.marriages).toBeLessThan(1);
  });

  it('缺先证者被惩罚', () => {
    const sample = pedigreeSamples[1]!; // 含 proband
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      for (const generation of wrong.generations) {
        for (const individual of generation.individuals) individual.proband = false;
      }
    }
    const dimensions = scorePedigree({ pedigree: wrong as PedigreeOutput['pedigree'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.proband).toBe(0);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of pedigreeSamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.pedigree.safeParse({ pedigree: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('pedigree eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number }> = [];
    for (const sample of pedigreeSamples) {
      const messages = composeMessages({
        task: 'pedigree',
        subject: '生物',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'pedigree',
        schema: TASK_SCHEMA.pedigree,
        messages,
        phase: 'high',
      })) as PedigreeOutput;
      const overall = pedigreeOverallScore(scorePedigree(output, sample.expected));
      results.push({ id: sample.id, overall });
    }
    const passed = results.filter((r) => pedigreeCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`pedigree eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
