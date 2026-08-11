import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type CellOutputRaw } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import {
  CELL_CASE_PASS_THRESHOLD,
  cellCasePassed,
  cellOverallScore,
  scoreCell,
} from './cell-scoring';
import { cellSamples } from './cell-samples';

describe('cell-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = cellSamples[0]!;
    const dimensions = scoreCell({ cell: sample.expected, reason: 'ok' }, sample.expected);
    expect(cellOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(cellCasePassed(cellOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出模式图被惩罚', () => {
    const negative = cellSamples.find((s) => s.expected === null)!;
    const ok = scoreCell({ cell: null, reason: '概念题' }, negative.expected);
    expect(cellOverallScore(ok)).toBeGreaterThanOrEqual(0.99);
    const bad = scoreCell({ cell: cellSamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(cellOverallScore(bad)).toBeLessThan(CELL_CASE_PASS_THRESHOLD);
  });

  it('关键细胞器缺失被惩罚', () => {
    const sample = cellSamples[0]!; // 植物细胞
    const wrong = structuredClone(sample.expected)!;
    wrong.organelles = wrong.organelles.filter((o) => o.type !== 'chloroplast');
    const dimensions = scoreCell({ cell: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.organelles).toBeLessThan(1);
  });

  it('连接引用不存在的细胞器导致 schema 校验失败', () => {
    const sample = cellSamples[0]!;
    const wrong = structuredClone(sample.expected)!;
    wrong.connections = [{ from: 'nope', to: 'c6', kind: 'energy' }];
    const dimensions = scoreCell({ cell: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.validity).toBe(0);
  });

  it('漏标注被惩罚', () => {
    const sample = cellSamples[1]!; // 动物细胞（含多个 label）
    const wrong = structuredClone(sample.expected)!;
    for (const item of wrong.organelles) {
      item.label = undefined;
      item.content = undefined;
    }
    const dimensions = scoreCell({ cell: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.labels).toBeLessThan(1);
  });

  it('细胞类型判断错误被惩罚', () => {
    const sample = cellSamples[2]!; // 原核细胞
    const wrong = structuredClone(sample.expected)!;
    wrong.cellType = 'animal';
    const dimensions = scoreCell({ cell: wrong, reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.cellType).toBe(0);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of cellSamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.cell.safeParse({ cell: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('cell eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number }> = [];
    for (const sample of cellSamples) {
      const messages = composeMessages({
        task: 'cell',
        subject: '生物',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'cell',
        schema: TASK_SCHEMA.cell,
        messages,
        phase: 'high',
      })) as CellOutputRaw;
      const overall = cellOverallScore(scoreCell(output, sample.expected));
      results.push({ id: sample.id, overall });
    }
    const passed = results.filter((r) => cellCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`cell eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
