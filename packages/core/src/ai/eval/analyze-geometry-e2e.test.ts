import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, geometryAstSchema, type AnalyzeOutput, type Block } from '../structured/schemas';
import { sanitizeBlocks } from '../structured/blocks';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import { attachGeometryVisualBlock } from '../../learning/actions';

/**
 * M-D 端到端：走生产 analyze 链路（composeMessages → structuredCall → sanitizeBlocks），
 * 验证几何题能稳定输出合法 Geometry AST visual block。
 * 需要 DEEPSEEK_API_KEY；缺省跳过（与 geometry-eval.test.ts 一致）。
 */
describe.skipIf(!process.env.DEEPSEEK_API_KEY)('analyze 生产链路几何 visual block（M-D 端到端）', () => {
  const cases: Array<{ id: string; question: string; rootType: 'scene' | 'coordinateSystem' }> = [
    {
      id: 'analyze-scene-triangle',
      question: '在三角形 ABC 中，∠A=60°，AB=5，AC=4，求 BC 的长。',
      rootType: 'scene',
    },
    {
      id: 'analyze-coordinate-parabola',
      question: '在同一坐标系中画出 y=x² 与 y=x+2 的图像，并求交点坐标。',
      rootType: 'coordinateSystem',
    },
  ];

  function geometryBlocksOf(result: AnalyzeOutput) {
    const all = [
      ...(result.answerBlocks ?? []),
      ...(result.analysisBlocks ?? []),
      ...(result.examPointsBlocks ?? []),
    ];
    return sanitizeBlocks(all)?.filter(isGeometryBlock) ?? [];
  }

  function isGeometryBlock(
    block: Block,
  ): block is Extract<Block, { type: 'visual' }> & { kind: 'geometry' } {
    return block.type === 'visual' && block.kind === 'geometry';
  }

  it('几何题产出合法 geometry visual block（至少一例），根类型正确', async () => {
    registerProvider(createDeepSeekProvider());

    let analyzeSuccess = 0;
    let produced = 0;
    for (const testCase of cases) {
      const messages = composeMessages({
        task: 'analyze',
        subject: '数学',
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
        // DeepSeek json_object 偶发输出非 JSON：analyze 自身失败时跳过该例。
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] analyze 调用失败（模型输出非 JSON），跳过：${String(err)}`);
        continue;
      }
      analyzeSuccess++;

      // 与 executeAnalyze 一致：后置几何检测，命中则前置 visual block。
      result.analysisBlocks = await attachGeometryVisualBlock({
        subject: '数学',
        question: testCase.question,
        blocks: result.analysisBlocks,
      });

      const geometryBlocks = geometryBlocksOf(result);
      if (geometryBlocks.length === 0) {
        // 模型判断波动（geometry task 返回 null）时允许该例无图。
        // eslint-disable-next-line no-console
        console.log(`[${testCase.id}] geometry task 判定无需图形，跳过严格断言`);
        continue;
      }
      produced++;
      // eslint-disable-next-line no-console
      console.log(
        `[${testCase.id}] blocks: ${JSON.stringify(
          { answerBlocks: result.answerBlocks, analysisBlocks: result.analysisBlocks, examPointsBlocks: result.examPointsBlocks },
          null,
          2,
        )}`,
      );
      // eslint-disable-next-line no-console
      console.log(`[${testCase.id}] geometryBlocks=${geometryBlocks.length}`);
      // eslint-disable-next-line no-console
      console.log(JSON.stringify(geometryBlocks, null, 2));

      for (const block of geometryBlocks) {
        const parsed = geometryAstSchema.safeParse(block.geometry);
        expect(parsed.success, `${testCase.id} geometry 应通过 schema 校验`).toBe(true);
        if (parsed.success) {
          expect(parsed.data.type, `${testCase.id} 根类型应为 ${testCase.rootType}`).toBe(testCase.rootType);
        }
      }
    }
    expect(analyzeSuccess, '至少一个 analyze 调用应成功').toBeGreaterThan(0);
    expect(produced, '至少一个几何题应产出 geometry visual block').toBeGreaterThan(0);
  }, 240_000);
});
