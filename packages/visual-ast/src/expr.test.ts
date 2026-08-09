import test from "node:test";
import assert from "node:assert/strict";
import { evaluateExpression } from "./expr.ts";

function expectValue(expr: string, x: number, expected: number): void {
  const actual = evaluateExpression(expr, x);
  assert.notEqual(actual, null, `${expr} 应可求值`);
  assert.ok(Math.abs((actual as number) - expected) < 1e-9, `${expr} 应为 ${expected}，实际 ${actual}`);
}

test("四则运算与优先级", () => {
  expectValue("1 + 2 * 3", 0, 7);
  expectValue("(1 + 2) * 3", 0, 9);
  expectValue("10 - 4 / 2", 0, 8);
  expectValue("2 * 3 + 4 * 5", 0, 26);
});

test("乘方右结合", () => {
  expectValue("2^3^2", 0, 512);
  expectValue("2^3", 0, 8);
});

test("一元负号优先级：-2^2 = -(2^2)", () => {
  expectValue("-2^2", 0, -4);
  expectValue("(-2)^2", 0, 4);
  expectValue("2^-2", 0, 0.25);
});

test("变量与常量", () => {
  expectValue("x + 1", 3, 4);
  expectValue("2*x^2 - 3*x + 1", 2, 3);
  expectValue("pi", 0, Math.PI);
  expectValue("e", 0, Math.E);
});

test("单参函数", () => {
  expectValue("sqrt(9)", 0, 3);
  expectValue("sin(pi/2)", 0, 1);
  expectValue("cos(0)", 0, 1);
  expectValue("abs(-5)", 0, 5);
  expectValue("log(100)", 0, 2);
  expectValue("ln(e)", 0, 1);
  expectValue("exp(0)", 0, 1);
});

test("双参函数", () => {
  expectValue("min(2, 5)", 0, 2);
  expectValue("max(2, 5)", 0, 5);
});

test("非法输入返回 null", () => {
  for (const bad of ["", "2+", "2**3", "2x", "foo(1)", "sqrt(-1)", "1/0", "(", "2 +", "x y"]) {
    assert.equal(evaluateExpression(bad, 0), null, `${bad} 应返回 null`);
  }
});

test("数字字符串直接返回", () => {
  expectValue("3.14", 0, 3.14);
});
