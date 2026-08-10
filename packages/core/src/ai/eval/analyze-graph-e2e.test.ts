import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, graphBlockSchema, type AnalyzeOutput, type Block } from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachGraphBlock } from '../../learning/actions';

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路 graph block（P1-4 端到端）', () => {
  const cases: Array<{ id: string; question: string }> = [
    {
      id: 'analyze-graph-food-chain',
      question: '画出食物链：草 → 兔 → 鹰，并分析各营养级。',
    },
    {
      id: 'analyze-graph-food-web',
      question: '某草原生态系统存在：草、鼠、兔、蛇、鹰，鼠和兔吃草，蛇吃鼠，鹰吃兔和蛇，画出食物网。',
    },
  ];

  function graphBlocksOf(result: AnalyzeOutput): Block[] {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter((b) => b.type === 'graph') ?? [];
  }

  it('食物链/网题产出合法 graph block（至少一例）', async () => {
    registerProvider(createDeepSeekProvider());
    let analyzeSuccess = 0;
    let produced = 0;
    for (const testCase of cases) {
      const messages = composeMessages({
        task: 'analyze',
        subject: '生物',
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
      result.analysisBlocks = await attachGraphBlock({
        subject: '生物',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });
      const graphBlocks = graphBlocksOf(result);
      if (graphBlocks.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] graph task 判定无需关系图，跳过严格断言`);
        continue;
      }
      produced++;
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] graphBlocks=${graphBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(graphBlocks, null, 2));
      for (const block of graphBlocks) {
        expect(graphBlockSchema.safeParse(block).success, `${testCase.id} graph 应通过 schema 校验`).toBe(true);
      }
    }
    expect(analyzeSuccess, '至少一个 analyze 调用应成功').toBeGreaterThan(0);
    expect(produced, '至少一个食物链/网题应产出 graph block').toBeGreaterThan(0);
  }, 240_000);
});
