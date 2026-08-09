import test from "node:test";
import assert from "node:assert/strict";
import { validateGeometryAst } from "./validate.ts";
import { computeBounds } from "./bounds.ts";
import { renderSVG } from "./render.ts";
import { samples, sampleNames } from "./samples.ts";

test("所有内置样例通过校验并渲染", () => {
  for (const name of sampleNames) {
    const ast = samples[name];
    const validation = validateGeometryAst(ast);
    assert.equal(validation.ok, true, `${name} 应通过校验: ${validation.errors.join("; ")}`);
    const svg = renderSVG(ast);
    assert.ok(svg.startsWith("<svg ") && svg.endsWith("</svg>"), `${name} 应渲染出完整 SVG`);
  }
});

test("computeBounds：scene 无显式 bounds 时自动适配", () => {
  const bounds = computeBounds(samples.triangleWithAngle);
  assert.equal(bounds.xMin, 0);
  assert.equal(bounds.yMin, 0);
  assert.equal(bounds.xMax, 5);
  assert.ok(Math.abs(bounds.yMax - 3.5) < 1e-9);
});

test("computeBounds：coordinateSystem 使用坐标轴范围", () => {
  const bounds = computeBounds(samples.coordinateParabola);
  assert.deepEqual(bounds, { xMin: -3, yMin: -1, xMax: 3, yMax: 6 });
});

test("computeBounds：空 scene 回退缺省区间", () => {
  const bounds = computeBounds({ type: "scene", elements: [] });
  assert.equal(bounds.xMin, -5);
  assert.equal(bounds.xMax, 5);
});
