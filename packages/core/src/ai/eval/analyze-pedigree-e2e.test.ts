import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, pedigreeBlockSchema, type AnalyzeOutput, type Block } from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachPedigreeBlock } from '../../learning/actions';

describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路 pedigree block（P1-4 端到端）', () => {
  const cases: Array<{ id: string; question: string }> = [
    {
      id: 'analyze-pedigree-recessive',
      question: '正常夫妇 I1（男）、I2（女）生下患病儿子 II1 和正常女儿 II2；II2 与正常男性 II3 结婚生下一个患病女儿 III1。分析该遗传病的遗传方式并画出系谱图。',
    },
    {
      id: 'analyze-pedigree-xlinked',
      question: '患病父亲 I1 与正常母亲 I2 生有正常儿子 II1 和患病女儿 II2（先证者），画出系谱图。',
    },
  ];

  function pedigreeBlocksOf(result: AnalyzeOutput): Block[] {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter((b) => b.type === 'pedigree') ?? [];
  }

  it('系谱题产出合法 pedigree block（至少一例）', async () => {
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
      result.analysisBlocks = await attachPedigreeBlock({
        subject: '生物',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });
      const pedigreeBlocks = pedigreeBlocksOf(result);
      if (pedigreeBlocks.length === 0) {
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] pedigree task 判定无需系谱图，跳过严格断言`);
        continue;
      }
      produced++;
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] pedigreeBlocks=${pedigreeBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(pedigreeBlocks, null, 2));
      for (const block of pedigreeBlocks) {
        expect(pedigreeBlockSchema.safeParse(block).success, `${testCase.id} pedigree 应通过 schema 校验`).toBe(true);
      }
    }
    expect(analyzeSuccess, '至少一个 analyze 调用应成功').toBeGreaterThan(0);
    expect(produced, '至少一个系谱题应产出 pedigree block').toBeGreaterThan(0);
  }, 240_000);
});
