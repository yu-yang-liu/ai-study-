import test from "node:test";
import assert from "node:assert/strict";
import { validateGeometryAst } from "./validate.ts";
import { samples } from "./samples.ts";

test("合法的 scene 通过校验", () => {
  const ast = samples.triangleWithAngle;
  assert.deepEqual(validateGeometryAst(ast), { ok: true, errors: [] });
});

test("合法的 coordinateSystem 通过校验", () => {
  const ast = samples.coordinateParabola;
  assert.deepEqual(validateGeometryAst(ast), { ok: true, errors: [] });
});

test("非对象根节点失败", () => {
  for (const bad of [null, undefined, 42, "scene", [], true]) {
    assert.equal(validateGeometryAst(bad).ok, false, `should reject ${JSON.stringify(bad)}`);
  }
});

test("未知根类型失败", () => {
  assert.equal(validateGeometryAst({ type: "picture", elements: [] }).ok, false);
});

test("未知元素类型失败", () => {
  assert.equal(
    validateGeometryAst({ type: "scene", elements: [{ type: "image", url: "x" }] }).ok,
    false,
  );
});

test("point 缺坐标 / 非有限数字失败", () => {
  const missingX = { type: "scene", elements: [{ type: "point", y: 1 }] };
  const nanY = { type: "scene", elements: [{ type: "point", x: 0, y: NaN }] };
  assert.equal(validateGeometryAst(missingX).ok, false);
  assert.equal(validateGeometryAst(nanY).ok, false);
});

test("circle 半径必须为正数", () => {
  const bad = { type: "scene", elements: [{ type: "circle", center: [0, 0], radius: -1 }] };
  const badZero = { type: "scene", elements: [{ type: "circle", center: [0, 0], radius: 0 }] };
  assert.equal(validateGeometryAst(bad).ok, false);
  assert.equal(validateGeometryAst(badZero).ok, false);
});

test("triangle 必须恰好 3 个顶点", () => {
  const bad = { type: "scene", elements: [{ type: "triangle", vertices: [[0, 0], [1, 0]] }] };
  assert.equal(validateGeometryAst(bad).ok, false);
});

test("polygon 必须 ≥3 个顶点", () => {
  const bad = { type: "scene", elements: [{ type: "polygon", points: [[0, 0], [1, 1]] }] };
  assert.equal(validateGeometryAst(bad).ok, false);
});

test("functionCurve expr 必须非空", () => {
  const bad = { type: "scene", elements: [{ type: "functionCurve", expr: "  " }] };
  assert.equal(validateGeometryAst(bad).ok, false);
});

test("label text 必须非空", () => {
  const bad = { type: "scene", elements: [{ type: "label", x: 0, y: 0, text: "" }] };
  assert.equal(validateGeometryAst(bad).ok, false);
});

test("bounds 顺序错误失败", () => {
  const bad = {
    type: "scene",
    elements: [],
    bounds: { xMin: 5, xMax: 0, yMin: 0, yMax: 5 },
  };
  const result = validateGeometryAst(bad);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((e) => e.includes("xMin")));
});

test("coordinateSystem 范围必须 min < max", () => {
  const bad = {
    type: "coordinateSystem",
    xRange: [3, -3],
    yRange: [-1, 1],
    children: [],
  };
  assert.equal(validateGeometryAst(bad).ok, false);
});

test("coordinateSystem children 必须是数组", () => {
  const bad = {
    type: "coordinateSystem",
    xRange: [-3, 3],
    yRange: [-1, 1],
    children: "oops",
  };
  assert.equal(validateGeometryAst(bad).ok, false);
});
