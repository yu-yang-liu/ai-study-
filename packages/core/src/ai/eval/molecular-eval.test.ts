import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type MolecularOutputRaw } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import {
  MOLECULAR_CASE_PASS_THRESHOLD,
  molecularCasePassed,
  molecularOverallScore,
  scoreMolecular,
} from './molecular-scoring';
import { molecularSamples } from './molecular-samples';

describe('molecular scoring', () => {
  it('scores a complete structure as passing', () => {
    const sample = molecularSamples[0]!;
    const score = molecularOverallScore(scoreMolecular({ molecular: sample.expected }, sample.expected));
    expect(score).toBeGreaterThanOrEqual(0.99);
    expect(molecularCasePassed(score)).toBe(true);
  });

  it('scores an unwanted diagram below the null threshold', () => {
    const negative = molecularSamples.find((sample) => sample.expected === null)!;
    const score = molecularOverallScore(scoreMolecular({ molecular: molecularSamples[0]!.expected }, negative.expected));
    expect(score).toBeLessThan(MOLECULAR_CASE_PASS_THRESHOLD);
  });

  it('penalizes missing bonds', () => {
    const sample = molecularSamples[1]!;
    const wrong = structuredClone(sample.expected)!;
    wrong.bonds = wrong.bonds.slice(0, 1);
    const dimensions = scoreMolecular({ molecular: wrong }, sample.expected);
    expect(dimensions.find((dimension) => dimension.name === 'bonds')?.score).toBeLessThan(1);
  });

  it('validates all expected samples against the task schema', () => {
    for (const sample of molecularSamples) {
      if (!sample.expected) continue;
      expect(TASK_SCHEMA.molecular.safeParse({ molecular: sample.expected }).success, sample.id).toBe(true);
    }
  });
});

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('molecular eval', () => {
  it('runs all molecular samples', async () => {
    registerProvider(createDeepSeekProvider());
    const results: number[] = [];
    for (const sample of molecularSamples) {
      const messages = composeMessages({
        task: 'molecular',
        subject: '化学',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'molecular',
        schema: TASK_SCHEMA.molecular,
        messages,
        phase: 'high',
      })) as MolecularOutputRaw;
      results.push(molecularOverallScore(scoreMolecular(output, sample.expected)));
    }
    const passed = results.filter(molecularCasePassed).length;
    expect(passed / results.length).toBeGreaterThanOrEqual(0.75);
  }, 600_000);
});
