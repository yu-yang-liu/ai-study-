import { evaluateExpression } from "./expr.ts";
import type { GeometryAST, GeometryElement, SceneBounds } from "./types.ts";

const DEFAULT_RANGE: [number, number] = [-5, 5];

/**
 * 计算渲染边界（数学坐标）。
 * - scene 显式声明 bounds 时原样返回；
 * - coordinateSystem 使用 xRange/yRange；
 * - 其余情况根据元素坐标 + 函数曲线采样自动适配。
 */
export function computeBounds(ast: GeometryAST): SceneBounds {
  if (ast.type === "coordinateSystem") {
    return { xMin: ast.xRange[0], xMax: ast.xRange[1], yMin: ast.yRange[0], yMax: ast.yRange[1] };
  }
  if (ast.bounds) return ast.bounds;

  const xs: number[] = [];
  const ys: number[] = [];
  for (const el of ast.elements) {
    collectPoints(el, xs, ys);
  }
  if (xs.length === 0) {
    return { xMin: DEFAULT_RANGE[0], yMin: DEFAULT_RANGE[0], xMax: DEFAULT_RANGE[1], yMax: DEFAULT_RANGE[1] };
  }
  return {
    xMin: Math.min(...xs),
    xMax: Math.max(...xs),
    yMin: Math.min(...ys),
    yMax: Math.max(...ys),
  };
}

function collectPoints(el: GeometryElement, xs: number[], ys: number[]): void {
  const push = (x: number, y: number): void => {
    xs.push(x);
    ys.push(y);
  };
  switch (el.type) {
    case "point":
    case "label":
      push(el.x, el.y);
      break;
    case "line":
    case "vector":
      push(el.from[0], el.from[1]);
      push(el.to[0], el.to[1]);
      break;
    case "triangle":
      for (const v of el.vertices) push(v[0], v[1]);
      break;
    case "polygon":
      for (const p of el.points) push(p[0], p[1]);
      break;
    case "circle":
      push(el.center[0] - el.radius, el.center[1]);
      push(el.center[0] + el.radius, el.center[1]);
      push(el.center[0], el.center[1] - el.radius);
      push(el.center[0], el.center[1] + el.radius);
      break;
    case "arc":
      push(el.center[0] - el.radius, el.center[1]);
      push(el.center[0] + el.radius, el.center[1]);
      push(el.center[0], el.center[1] - el.radius);
      push(el.center[0], el.center[1] + el.radius);
      break;
    case "angle":
      push(el.vertex[0], el.vertex[1]);
      push(el.from[0], el.from[1]);
      push(el.to[0], el.to[1]);
      break;
    case "functionCurve": {
      const [xMin, xMax] = el.xRange ?? DEFAULT_RANGE;
      const samples = el.samples && el.samples >= 2 ? el.samples : 160;
      let found = false;
      for (let i = 0; i <= samples; i++) {
        const x = xMin + ((xMax - xMin) * i) / samples;
        const y = evaluateExpression(el.expr, x);
        if (y !== null) {
          push(x, y);
          found = true;
        }
      }
      // 表达式完全无有效点时给一个缺省区间，避免退化边界。
      if (!found) {
        xs.push(xMin, xMax);
        ys.push(-1, 1);
      }
      break;
    }
  }
}
