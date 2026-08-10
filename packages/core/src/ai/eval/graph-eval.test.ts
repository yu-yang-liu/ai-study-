import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type GraphOutput } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { GRAPH_CASE_PASS_THRESHOLD, graphCasePassed, graphOverallScore, scoreGraph } from './graph-scoring';
import { graphSamples } from './graph-samples';

describe('graph-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = graphSamples[0]!;
    const dimensions = scoreGraph({ graph: sample.expected, reason: 'ok' }, sample.expected);
    expect(graphOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(graphCasePassed(graphOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出图被惩罚', () => {
    const negative = graphSamples.find((s) => s.expected === null)!;
    const ok = scoreGraph({ graph: null, reason: '概念题' }, negative.expected);
    expect(graphOverallScore(ok)).toBeGreaterThanOrEqual(0.99);
    const bad = scoreGraph({ graph: graphSamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(graphOverallScore(bad)).toBeLessThan(GRAPH_CASE_PASS_THRESHOLD);
  });

  it('边方向错误（反向）被惩罚', () => {
    const sample = graphSamples[0]!;
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      wrong.edges = wrong.edges.map((e) => ({ from: e.to, to: e.from }));
    }
    const dimensions = scoreGraph({ graph: wrong as GraphOutput['graph'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.edges).toBeLessThan(1);
  });

  it('节点类型错误被惩罚', () => {
    const sample = graphSamples[0]!;
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      const producer = wrong.nodes.find((n) => n.kind === 'producer');
      if (producer) producer.kind = 'consumer';
    }
    const dimensions = scoreGraph({ graph: wrong as GraphOutput['graph'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.nodes).toBeLessThan(1);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of graphSamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.graph.safeParse({ graph: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('graph eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number }> = [];
    for (const sample of graphSamples) {
      const messages = composeMessages({
        task: 'graph',
        subject: '生物',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'graph',
        schema: TASK_SCHEMA.graph,
        messages,
        phase: 'high',
      })) as GraphOutput;
      const overall = graphOverallScore(scoreGraph(output, sample.expected));
      results.push({ id: sample.id, overall });
    }
    const passed = results.filter((r) => graphCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`graph eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
