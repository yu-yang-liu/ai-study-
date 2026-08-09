import test from "node:test";
import assert from "node:assert/strict";
import { renderSVG } from "./render.ts";
import { samples } from "./samples.ts";

test("三角形样例：输出 svg + polygon + 角弧 + 顶点标注", () => {
  const svg = renderSVG(samples.triangleWithAngle);
  assert.ok(svg.startsWith("<svg "), "应以 <svg 开头");
  assert.ok(svg.includes("</svg>"), "应闭合 svg");
  assert.ok(svg.includes("<polygon"), "应包含三角形轮廓");
  assert.ok(svg.includes("<path"), "应包含角弧 path");
  assert.ok(svg.includes("60°"), "应包含 60° 标注");
  assert.ok(svg.includes("A"), "应包含顶点标注 A");
});

test("坐标系样例：输出坐标轴与函数曲线", () => {
  const svg = renderSVG(samples.coordinateParabola);
  assert.ok(svg.includes("<polyline"), "应包含函数曲线 polyline");
  assert.ok(svg.includes("y=x²"), "应包含曲线标注");
  assert.ok(svg.includes("stroke=\"#dc2626\""), "第二条曲线应使用指定颜色");
});

test("圆与内接三角形：输出 circle 与虚线", () => {
  const svg = renderSVG(samples.circleInscribedTriangle);
  assert.ok(svg.includes("<circle"), "应包含圆");
  assert.ok(svg.includes("stroke-dasharray"), "应包含虚线辅助线");
});

test("力学样例：向量带箭头", () => {
  const svg = renderSVG(samples.forceDiagram);
  assert.ok(svg.includes("F₁"), "应包含 F₁ 标注");
  assert.ok(svg.includes("<polygon"), "箭头应使用 polygon 绘制");
});

test("显式 bounds 生效：viewBox 与渲染尺寸", () => {
  const ast = {
    type: "scene" as const,
    elements: [
      { type: "point" as const, x: 0, y: 0 },
      { type: "point" as const, x: 10, y: 10 },
    ],
    bounds: { xMin: -1, yMin: -1, xMax: 11, yMax: 11 },
  };
  const svg = renderSVG(ast, { width: 400, height: 300 });
  assert.ok(svg.includes('width="400"'));
  assert.ok(svg.includes('height="300"'));
  assert.ok(svg.includes('viewBox="0 0 400 300"'));
});

test("自定义渲染选项生效", () => {
  const svg = renderSVG(samples.rightTriangle, { width: 320, height: 240, background: "#f8fafc" });
  assert.ok(svg.includes('width="320"'));
  assert.ok(svg.includes('height="240"'));
  assert.ok(svg.includes('fill="#f8fafc"'));
  assert.ok(svg.includes("90°"), "直角应标注 90°");
});
