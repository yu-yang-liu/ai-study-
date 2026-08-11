import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, labBlockSchema, type AnalyzeOutput, type Block } from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachLabBlock } from '../../learning/actions';

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路 lab block（P2-1 端到端）', () => {
  const cases: Array<{ id: string; question: string }> = [
    {
      id: 'analyze-lab-oxygen',
      question: '实验室用二氧化锰催化分解过氧化氢溶液制取氧气，应选择哪种发生装置和收集装置？画出装置图并说明理由。',
    },
    {
      id: 'analyze-lab-distillation',
      question: '实验室蒸馏含少量水的乙醇，需要哪些仪器？画出蒸馏装置图。',
    },
  ];

  function labBlocksOf(result: AnalyzeOutput): Block[] {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter((b) => b.type === 'lab') ?? [];
  }

  it('实验装置题产出合法 lab block（至少一例）', async () => {
    registerProvider(createDeepSeekProvider());
    let analyzeSuccess = 0;
    let produced = 0;
    for (const testCase of cases) {
      const messages = composeMessages({
        task: 'analyze',
        subject: '化学',
        phase: 'high',
        userInput: testCase.question,
      });
      let result: AnalyzeOutput;
      try {
        result = (await structuredCall({
          task: 'analyze',
          schema: TASK_SCHEMA.analyze,
          messages,
          phase: 'high',
        })) as AnalyzeOutput;
      } catch (err) {
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] analyze 调用失败，跳过：${String(err)}`);
        continue;
      }
      analyzeSuccess++;
      result.analysisBlocks = await attachLabBlock({
        subject: '化学',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });
      const labBlocks = labBlocksOf(result);
      if (labBlocks.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] lab task 判定无需装置图，跳过严格断言`);
        continue;
      }
      produced++;
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] labBlocks=${labBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(labBlocks, null, 2));
      for (const block of labBlocks) {
        expect(labBlockSchema.safeParse(block).success, `${testCase.id} lab 应通过 schema 校验`).toBe(true);
      }
    }
    expect(analyzeSuccess, '至少一个 analyze 调用应成功').toBeGreaterThan(0);
    expect(produced, '至少一个实验装置题应产出 lab block').toBeGreaterThan(0);
  }, 240_000);
});
