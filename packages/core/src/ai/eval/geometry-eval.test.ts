import { describe, expect, it } from 'vitest';
import { composeMessages } from '../prompt';
import { structuredCall } from '../structured/call';
import { TASK_SCHEMA, type GeometryOutput } from '../structured/schemas';
import { registerProvider } from '../gateway/registry';
import { createDeepSeekProvider } from '../providers/deepseek';
import {
  geometryCasePassed,
  geometryOverallScore,
  GEOMETRY_CASE_PASS_THRESHOLD,
  scoreGeometry,
} from './geometry-scoring';
import { geometrySamples } from './geometry-samples';

/** 对 scene 元素整体应用点变换（平移/旋转/缩放/镜像），angle 顶点一并变换。 */
function transformSceneElements(
  ast: NonNullable<GeometryOutput['geometry']>,
  transform: (p: [number, number]) => [number, number],
): NonNullable<GeometryOutput['geometry']> {
  const clone = structuredClone(ast) as unknown as {
    type: 'scene';
    elements: Array<{
      type: string;
      vertices?: [number, number][];
      vertex?: [number, number];
      from?: [number, number];
      to?: [number, number];
      center?: [number, number];
    }>;
  };
  for (const element of clone.elements) {
    if (element.vertices) element.vertices = element.vertices.map(transform);
    if (element.vertex) element.vertex = transform(element.vertex);
    if (element.from) element.from = transform(element.from);
    if (element.to) element.to = transform(element.to);
    if (element.center) element.center = transform(element.center);
  }
  return clone as NonNullable<GeometryOutput['geometry']>;
}

describe('geometry-scoring 纯函数', () => {
  it('完美输出接近满分', () => {
    const sample = geometrySamples[0]!;
    const expected = sample.expected!;
    const dimensions = scoreGeometry({ geometry: expected, reason: 'ok' }, expected);
    expect(geometryOverallScore(dimensions)).toBeGreaterThanOrEqual(0.99);
    expect(geometryCasePassed(geometryOverallScore(dimensions))).toBe(true);
  });

  it('负例输出 null 满分，输出图形被惩罚', () => {
    const negative = geometrySamples.find((s) => s.expected === null)!;
    const ok = scoreGeometry({ geometry: null, reason: '代数题' }, negative.expected);
    expect(geometryOverallScore(ok)).toBeGreaterThanOrEqual(0.99);

    const bad = scoreGeometry({ geometry: geometrySamples[0]!.expected, reason: '误判' }, negative.expected);
    expect(geometryOverallScore(bad)).toBeLessThan(GEOMETRY_CASE_PASS_THRESHOLD);
  });

  it('需要图形但输出 null 被判不合格', () => {
    const sample = geometrySamples[0]!;
    const dimensions = scoreGeometry({ geometry: null, reason: '漏输出' }, sample.expected);
    expect(geometryOverallScore(dimensions)).toBeLessThan(GEOMETRY_CASE_PASS_THRESHOLD);
  });

  it('根类型错误被惩罚', () => {
    const sample = geometrySamples[1]!; // coordinateSystem
    const expected = sample.expected!;
    if (expected.type !== 'coordinateSystem') throw new Error('sample 2 应为 coordinateSystem');
    const wrongRoot = structuredClone(expected);
    const dimensions = scoreGeometry(
      { geometry: { type: 'scene', elements: wrongRoot.children } as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.rootType).toBe(0);
    expect(geometryOverallScore(dimensions)).toBeLessThan(1);
  });

  it('整体平移视为等价（v2）', () => {
    const sample = geometrySamples[0]!;
    const expected = sample.expected!;
    const shifted = transformSceneElements(expected, (p) => [p[0] + 3, p[1] + 3]);
    const dimensions = scoreGeometry(
      { geometry: shifted as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    expect(geometryOverallScore(dimensions)).toBeGreaterThanOrEqual(0.9);
  });

  it('整体旋转视为等价（v2）', () => {
    const sample = geometrySamples[0]!;
    const expected = sample.expected!;
    const rotated = transformSceneElements(expected, (p) => [-p[1], p[0]]);
    const dimensions = scoreGeometry(
      { geometry: rotated as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    expect(geometryOverallScore(dimensions)).toBeGreaterThanOrEqual(0.9);
  });

  it('整体缩放视为等价（v2）', () => {
    const sample = geometrySamples[0]!;
    const expected = sample.expected!;
    const scaled = transformSceneElements(expected, (p) => [p[0] * 2, p[1] * 2]);
    const dimensions = scoreGeometry(
      { geometry: scaled as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    expect(geometryOverallScore(dimensions)).toBeGreaterThanOrEqual(0.9);
  });

  it('镜像不视为等价（v2）', () => {
    const sample = geometrySamples[8]!; // geometry-09：仅三角形，避免单点元素稀释
    const expected = sample.expected!;
    const mirrored = transformSceneElements(expected, (p) => [-p[0], p[1]]);
    const dimensions = scoreGeometry(
      { geometry: mirrored as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.coordinate).toBeLessThan(0.5);
  });

  it('向量方向敏感（v2，不做旋转等价）', () => {
    const sample = geometrySamples[3]!; // force-diagram
    const expected = sample.expected!;
    const rotated = transformSceneElements(expected, (p) => [-p[1], p[0]]);
    const dimensions = scoreGeometry(
      { geometry: rotated as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.coordinate).toBeLessThan(0.6);
  });

  it('表达式不一致被惩罚', () => {
    const sample = geometrySamples[1]!;
    const expected = sample.expected!;
    const wrong = structuredClone(expected) as unknown as {
      type: 'coordinateSystem';
      children: Array<{ type: string; expr?: string }>;
    };
    const curve = wrong.children.find((e) => e.type === 'functionCurve')!;
    curve.expr = 'x^3';
    const dimensions = scoreGeometry(
      { geometry: wrong as unknown as GeometryOutput['geometry'], reason: 'x' },
      expected,
    );
    const byName = Object.fromEntries(dimensions.map((d) => [d.name, d.score]));
    expect(byName.expression).toBeLessThan(1);
  });

  it('所有样本的期望值本身通过 schema 校验', () => {
    for (const sample of geometrySamples) {
      if (sample.expected === null) continue;
      const result = TASK_SCHEMA.geometry.safeParse({ geometry: sample.expected });
      expect(result.success, sample.id).toBe(true);
    }
  });
});

// 真跑 LLM eval：需要 DEEPSEEK_API_KEY；缺省跳过。
describe.skipIf(!process.env.DEEPSEEK_API_KEY)('geometry eval（需 key）', () => {
  it('运行全部样本并报告准确率', async () => {
    registerProvider(createDeepSeekProvider());
    const results: Array<{ id: string; overall: number; dimensions: Record<string, number> }> = [];
    for (const sample of geometrySamples) {
      const messages = composeMessages({
        task: 'geometry',
        subject: '数学',
        phase: 'high',
        userInput: sample.question,
      });
      const output = (await structuredCall({
        task: 'geometry',
        schema: TASK_SCHEMA.geometry,
        messages,
        phase: 'high',
      })) as GeometryOutput;
      const dimensions = scoreGeometry(output, sample.expected);
      results.push({
        id: sample.id,
        overall: geometryOverallScore(dimensions),
        dimensions: Object.fromEntries(dimensions.map((d) => [d.name, d.score])),
      });
    }
    const passed = results.filter((r) => geometryCasePassed(r.overall)).length;
    const rate = passed / results.length;
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(results, null, 2));
    // eslint-disable-next-line no-console
    console.log(`geometry eval 通过率：${(rate * 100).toFixed(0)}% (${passed}/${results.length})`);
    expect(rate).toBeGreaterThanOrEqual(0.8);
  }, 600_000);
});
