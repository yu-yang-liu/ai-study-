import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, circuitBlockSchema, type AnalyzeOutput, type Block } from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachCircuitBlock } from '../../learning/actions';

/**
 * P1-2 端到端：走生产 analyze 链路 + 后置 circuit 检测，
 * 验证物理电路题能产出合法 Circuit AST block。
 */
describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路 circuit block（P1-2 端到端）', () => {
  const cases: Array<{ id: string; question: string; nodeTypes: string[] }> = [
    {
      id: 'analyze-circuit-series',
      question: '一个由电池、开关和灯泡组成的串联电路，请分析并画出电路图。',
      nodeTypes: ['battery', 'switch', 'bulb'],
    },
    {
      id: 'analyze-circuit-ohm',
      question: '用伏安法测量未知电阻 Rx：电池、开关、电阻 Rx、电流表串联，电压表并联在 Rx 两端，画出电路图。',
      nodeTypes: ['battery', 'switch', 'ammeter', 'resistor', 'voltmeter'],
    },
  ];

  function circuitBlocksOf(result: AnalyzeOutput): Block[] {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter((b) => b.type === 'circuit') ?? [];
  }

  it('两个物理电路题均产出合法 circuit block，且含关键元件', async () => {
    registerProvider(createDeepSeekProvider());

    for (const testCase of cases) {
      const messages = composeMessages({
        task: 'analyze',
        subject: '物理',
        phase: 'high',
        userInput: testCase.question,
      });
      const result = (await structuredCall({
        task: 'analyze',
        schema: TASK_SCHEMA.analyze,
        messages,
        phase: 'high',
      })) as AnalyzeOutput;

      result.analysisBlocks = await attachCircuitBlock({
        subject: '物理',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });

      const circuitBlocks = circuitBlocksOf(result);
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] circuitBlocks=${circuitBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(circuitBlocks, null, 2));

      expect(circuitBlocks.length, `${testCase.id} 应输出 circuit block`).toBeGreaterThan(0);
      for (const block of circuitBlocks) {
        const parsed = circuitBlockSchema.safeParse(block);
        expect(parsed.success, `${testCase.id} circuit 应通过 schema 校验`).toBe(true);
        if (parsed.success) {
          const types = new Set(parsed.data.nodes.map((node) => node.type));
          for (const nodeType of testCase.nodeTypes) {
            expect(types.has(nodeType as never), `${testCase.id} 应包含元件 ${nodeType}`).toBe(true);
          }
        }
      }
    }
  }, 240_000);
});
