import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import {
  TASK_SCHEMA,
  cellBlockSchema,
  type AnalyzeOutput,
  type Block,
} from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachCellBlock } from '../../learning/actions';

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路 cell block（P2-2 端到端）', () => {
  const cases: Array<{ id: string; question: string }> = [
    {
      id: 'analyze-cell-plant',
      question: '请画出高等植物细胞的结构模式图，并标注细胞壁、细胞膜、细胞核、叶绿体、线粒体、液泡和核糖体。',
    },
    {
      id: 'analyze-cell-transport',
      question: '葡萄糖借助载体蛋白以协助扩散方式进入红细胞，请画出跨膜运输示意图并标出方向。',
    },
  ];

  function cellBlocksOf(result: AnalyzeOutput): Block[] {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter((b) => b.type === 'cell') ?? [];
  }

  it('细胞模式图题产出合法 cell block（至少一例）', async () => {
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
      result.analysisBlocks = await attachCellBlock({
        subject: '生物',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });
      const cellBlocks = cellBlocksOf(result);
      if (cellBlocks.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] cell task 判定无需模式图，跳过严格断言`);
        continue;
      }
      produced++;
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] cellBlocks=${cellBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(cellBlocks, null, 2));
      for (const block of cellBlocks) {
        expect(cellBlockSchema.safeParse(block).success, `${testCase.id} cell 应通过 schema 校验`).toBe(true);
      }
    }
    expect(analyzeSuccess, '至少一个 analyze 调用应成功').toBeGreaterThan(0);
    expect(produced, '至少一个细胞模式图题应产出 cell block').toBeGreaterThan(0);
  }, 240_000);
});
