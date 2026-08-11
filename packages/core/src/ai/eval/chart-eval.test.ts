import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type ChartOutput } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { CHART_CASE_PASS_THRESHOLD, chartCasePassed, chartOverallScore, scoreChart } from './chart-scoring';
import { chartSamples } from './chart-samples';

describe('chart-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = chartSamples[0]!;
    const dimensions = scoreChart({ chart: sample.expected, reason: 'ok' }, sample.expected);
    expect(chartOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(chartCasePassed(chartOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出图表被惩罚', () => {
    const negative = chartSamples.find((s) => s.expected === null)!;
    const ok = scoreChart({ chart: null, reason: '代数题' }, negative.expected);
    expect(chartOverallScore(ok)).toBeGreaterThanOrEqual(0.99);

    const bad = scoreChart({ chart: chartSamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(chartOverallScore(bad)).toBeLessThan(CHART_CASE_PASS_THRESHOLD);
  });

  it('需要图表但输出 null 被判不合格', () => {
    const sample = chartSamples[0]!;
    const dimensions = scoreChart({ chart: null, reason: '漏输出' }, sample.expected);
    expect(chartOverallScore(dimensions)).toBeLessThan(CHART_CASE_PASS_THRESHOLD);
  });

  it('图表类型错误被惩罚', () => {
    const sample = chartSamples[1]!; // line
    const wrong = structuredClone(sample.expected)!;
    (wrong as { kind: string }).kind = 'bar';
    const dimensions = scoreChart({ chart: wrong as ChartOutput['chart'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.kind).toBe(0);
    expect(chartOverallScore(dimensions)).toBeLessThan(1);
  });

  it('数值偏差被惩罚', () => {
    const sample = chartSamples[0]!; // bar
    const wrong = structuredClone(sample.expected)!;
    if (wrong && wrong.kind === 'bar') {
      wrong.series[0]!.values = wrong.series[0]!.values.map((v) => v * 2);
    }
    const dimensions = scoreChart({ chart: wrong as ChartOutput['chart'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.values).toBeLessThan(1);
  });

  it('直方图区间偏移被惩罚', () => {
    const sample = chartSamples[3]!; // histogram
    const wrong = structuredClone(sample.expected)!;
    if (wrong && wrong.kind === 'histogram') {
      wrong.bins = wrong.bins.map((b) => ({ range: [b.range[0] + 5, b.range[1] + 5] as [number, number], count: b.count }));
    }
    const dimensions = scoreChart({ chart: wrong as ChartOutput['chart'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.bins).toBeLessThan(1);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of chartSamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.chart.safeParse({ chart: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

// 真跑 LLM eval：需要 DEEPSEEK_API_KEY；缺省跳过。
describe.skipIf(!process.env.DEEPSEEK_API_KEY)('chart eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number }> = [];
    for (const sample of chartSamples) {
      const messages = composeMessages({
        task: 'chart',
        subject: '数学',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'chart',
        schema: TASK_SCHEMA.chart,
        messages,
        phase: 'high',
      })) as ChartOutput;
      const overall = chartOverallScore(scoreChart(output, sample.expected));
      results.push({ id: sample.id, overall });
    }
    const passed = results.filter((r) => chartCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`chart eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
