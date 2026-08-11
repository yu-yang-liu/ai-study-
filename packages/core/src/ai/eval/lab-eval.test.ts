import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type LabOutputRaw } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import {
  LAB_CASE_PASS_THRESHOLD,
  labCasePassed,
  labOverallScore,
  scoreLab,
} from './lab-scoring';
import { labSamples } from './lab-samples';

describe('lab-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = labSamples[0]!;
    const dimensions = scoreLab({ lab: sample.expected, reason: 'ok' }, sample.expected);
    expect(labOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(labCasePassed(labOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出装置图被惩罚', () => {
    const negative = labSamples.find((s) => s.expected === null)!;
    const ok = scoreLab({ lab: null, reason: '概念题' }, negative.expected);
    expect(labOverallScore(ok)).toBeGreaterThanOrEqual(0.99);
    const bad = scoreLab({ lab: labSamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(labOverallScore(bad)).toBeLessThan(LAB_CASE_PASS_THRESHOLD);
  });

  it('主体器材缺失被惩罚', () => {
    const sample = labSamples[1]!; // 蒸馏装置
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      wrong.apparatus = wrong.apparatus.filter((a) => a.type !== 'condenser');
    }
    const dimensions = scoreLab({ lab: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.apparatus).toBeLessThan(1);
  });

  it('连接关系错误被惩罚', () => {
    const sample = labSamples[0]!; // 制气装置
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      wrong.connections = [{ from: 'a3', to: 'a5', kind: 'gasFlow' }];
    }
    const dimensions = scoreLab({ lab: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.connections).toBeLessThan(1);
  });

  it('缺少标注被惩罚', () => {
    const sample = labSamples[2]!; // 过滤装置（含滤纸/玻璃棒标注）
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      for (const item of wrong.apparatus) {
        item.label = undefined;
        item.content = undefined;
      }
    }
    const dimensions = scoreLab({ lab: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.labels).toBeLessThan(1);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of labSamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.lab.safeParse({ lab: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('lab eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number }> = [];
    for (const sample of labSamples) {
      const messages = composeMessages({
        task: 'lab',
        subject: '化学',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'lab',
        schema: TASK_SCHEMA.lab,
        messages,
        phase: 'high',
      })) as LabOutputRaw;
      const overall = labOverallScore(scoreLab(output, sample.expected));
      results.push({ id: sample.id, overall });
    }
    const passed = results.filter((r) => labCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`lab eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
