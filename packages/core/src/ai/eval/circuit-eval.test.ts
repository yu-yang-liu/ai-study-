import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type CircuitOutput } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { CIRCUIT_CASE_PASS_THRESHOLD, circuitCasePassed, circuitOverallScore, scoreCircuit } from './circuit-scoring';
import { circuitSamples } from './circuit-samples';

describe('circuit-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = circuitSamples[0]!;
    const dimensions = scoreCircuit({ circuit: sample.expected, reason: 'ok' }, sample.expected);
    expect(circuitOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(circuitCasePassed(circuitOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出电路被惩罚', () => {
    const negative = circuitSamples.find((s) => s.expected === null)!;
    const ok = scoreCircuit({ circuit: null, reason: '概念题' }, negative.expected);
    expect(circuitOverallScore(ok)).toBeGreaterThanOrEqual(0.99);

    const bad = scoreCircuit({ circuit: circuitSamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(circuitOverallScore(bad)).toBeLessThan(CIRCUIT_CASE_PASS_THRESHOLD);
  });

  it('需要电路图但输出 null 被判不合格', () => {
    const sample = circuitSamples[0]!;
    const dimensions = scoreCircuit({ circuit: null, reason: '漏输出' }, sample.expected);
    expect(circuitOverallScore(dimensions)).toBeLessThan(CIRCUIT_CASE_PASS_THRESHOLD);
  });

  it('导线引用不存在的节点：validity 记 0', () => {
    const sample = circuitSamples[0]!;
    const wrong = structuredClone(sample.expected)!;
    wrong.wires = [{ from: 'b1', to: 'ghost' }];
    const dimensions = scoreCircuit({ circuit: wrong as CircuitOutput['circuit'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.validity).toBe(0);
  });

  it('拓扑错误（灯泡换成电阻）被惩罚', () => {
    const sample = circuitSamples[1]!; // two bulbs series
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      const second = wrong.nodes.find((n) => n.id === 'l2');
      if (second) second.type = 'resistor';
    }
    const dimensions = scoreCircuit({ circuit: wrong as CircuitOutput['circuit'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.connections).toBeLessThan(1);
    expect(byName.components).toBeLessThan(1);
  });

  it('缺少元件参数 value 被惩罚', () => {
    const sample = circuitSamples[0]!; // battery with 6V
    const wrong = structuredClone(sample.expected)!;
    if (wrong) {
      const battery = wrong.nodes.find((n) => n.type === 'battery');
      if (battery) battery.value = undefined;
    }
    const dimensions = scoreCircuit({ circuit: wrong as CircuitOutput['circuit'], reason: 'x' }, sample.expected);
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.values).toBeLessThan(1);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of circuitSamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.circuit.safeParse({ circuit: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

// 真跑 LLM eval：需要 DEEPSEEK_API_KEY；缺省跳过。
describe.skipIf(!process.env.DEEPSEEK_API_KEY)('circuit eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number }> = [];
    for (const sample of circuitSamples) {
      const messages = composeMessages({
        task: 'circuit',
        subject: '物理',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'circuit',
        schema: TASK_SCHEMA.circuit,
        messages,
        phase: 'high',
      })) as CircuitOutput;
      const overall = circuitOverallScore(scoreCircuit(output, sample.expected));
      results.push({ id: sample.id, overall });
    }
    const passed = results.filter((r) => circuitCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`circuit eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
