import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, chartBlockSchema, type AnalyzeOutput, type Block } from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachChartBlock } from '../../learning/actions';

/**
 * P1-1 端到端：走生产 analyze 链路 + 后置 chart 检测，
 * 验证统计题能产出合法 Chart AST block。
 */
describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路 chart block（P1-1 端到端）', () => {
  const cases: Array<{ id: string; question: string; kind: string }> = [
    {
      id: 'analyze-chart-histogram',
      question: '50 名学生数学成绩分组频数：[60,70) 8 人、[70,80) 15 人、[80,90) 18 人、[90,100] 9 人，分析成绩分布并画出频率分布直方图。',
      kind: 'histogram',
    },
    {
      id: 'analyze-chart-bar',
      question: '某班 40 名同学数学成绩等级分布为：A 等 12 人、B 等 18 人、C 等 7 人、D 等 3 人，请分析并画出柱状图。',
      kind: 'bar',
    },
  ];

  function chartBlocksOf(result: AnalyzeOutput): Block[] {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter((b) => b.type === 'chart') ?? [];
  }

  it('统计题产出合法 chart block（至少一例），kind 正确', async () => {
    registerProvider(createDeepSeekProvider());

    let produced = 0;
    for (const testCase of cases) {
      const messages = composeMessages({
        task: 'analyze',
        subject: '数学',
        phase: 'high',
        userInput: testCase.question,
      });
      const result = (await structuredCall({
        task: 'analyze',
        schema: TASK_SCHEMA.analyze,
        messages,
        phase: 'high',
      })) as AnalyzeOutput;

      // 与 executeAnalyze 一致：后置 chart 检测，命中则追加 chart block。
      result.analysisBlocks = await attachChartBlock({
        subject: '数学',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });

      const chartBlocks = chartBlocksOf(result);
      if (chartBlocks.length === 0) {
        // 模型判断波动（chart task 返回 null）时允许该例无图，但整体至少一例产出。
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] chart task 判定无需图表，跳过严格断言`);
        continue;
      }
      produced++;
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] chartBlocks=${chartBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(chartBlocks, null, 2));

      for (const block of chartBlocks) {
        const parsed = chartBlockSchema.safeParse(block);
        expect(parsed.success, `${testCase.id} chart 应通过 schema 校验`).toBe(true);
        if (parsed.success) {
          expect(parsed.data.kind, `${testCase.id} kind 应为 ${testCase.kind}`).toBe(testCase.kind as never);
        }
      }
    }
    expect(produced, '至少一个统计题应产出 chart block').toBeGreaterThan(0);
  }, 240_000);
});
