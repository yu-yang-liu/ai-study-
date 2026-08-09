import type {
  GeometryAST,
} from "./types.ts";

/**
 * 校验结果。errors 为空即合法。
 */
export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

const ELEMENT_TYPES = new Set([
  "point",
  "line",
  "vector",
  "triangle",
  "polygon",
  "circle",
  "arc",
  "angle",
  "functionCurve",
  "label",
]);

/**
 * 校验任意输入是否为合法 Geometry AST。
 * 纯函数、零依赖；错误信息带路径，便于 AI 输出修复提示。
 */
export function validateGeometryAst(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (typeof value !== "object" || value === null) {
    return { ok: false, errors: ["root 必须是对象"] };
  }
  const root = value as Record<string, unknown>;
  const type = root.type;
  if (type === "scene") {
    validateScene(root, errors);
  } else if (type === "coordinateSystem") {
    validateCoordinateSystem(root, errors);
  } else {
    errors.push('root.type 必须是 "scene" 或 "coordinateSystem"');
  }
  return { ok: errors.length === 0, errors };
}

/** 类型收窄辅助：合法时返回 GeometryAST。 */
export function isGeometryAst(value: unknown): value is GeometryAST {
  return validateGeometryAst(value).ok;
}

function validateScene(root: Record<string, unknown>, errors: string[]): void {
  if (!Array.isArray(root.elements)) {
    errors.push("scene.elements 必须是数组");
    return;
  }
  root.elements.forEach((el, i) => validateElement(el, `elements[${i}]`, errors));
  if (root.bounds !== undefined) {
    validateBounds(root.bounds, "bounds", errors);
  }
}

function validateCoordinateSystem(
  root: Record<string, unknown>,
  errors: string[],
): void {
  validateRange(root.xRange, "xRange", errors);
  validateRange(root.yRange, "yRange", errors);
  if (typeof root.xStep === "number" && !(root.xStep > 0)) {
    errors.push("xStep 必须是正数");
  }
  if (typeof root.yStep === "number" && !(root.yStep > 0)) {
    errors.push("yStep 必须是正数");
  }
  if (!Array.isArray(root.children)) {
    errors.push("coordinateSystem.children 必须是数组");
    return;
  }
  root.children.forEach((el, i) => validateElement(el, `children[${i}]`, errors));
}

function validateBounds(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "object" || value === null) {
    errors.push(`${path} 必须是对象`);
    return;
  }
  const b = value as Record<string, unknown>;
  const xMin = b.xMin;
  const yMin = b.yMin;
  const xMax = b.xMax;
  const yMax = b.yMax;
  if (!isFiniteNumber(xMin) || !isFiniteNumber(yMin) || !isFiniteNumber(xMax) || !isFiniteNumber(yMax)) {
    errors.push(`${path} 的 xMin/yMin/xMax/yMax 必须是有限数字`);
    return;
  }
  if (xMin >= xMax) errors.push(`${path}.xMin 必须小于 xMax`);
  if (yMin >= yMax) errors.push(`${path}.yMin 必须小于 yMax`);
}

function validateRange(value: unknown, path: string, errors: string[]): void {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    !isFiniteNumber(value[0]) ||
    !isFiniteNumber(value[1]) ||
    value[0] >= value[1]
  ) {
    errors.push(`${path} 必须是 [min, max] 且 min < max`);
  }
}

function validateElement(value: unknown, path: string, errors: string[]): void {
  if (typeof value !== "object" || value === null) {
    errors.push(`${path} 必须是对象`);
    return;
  }
  const el = value as Record<string, unknown>;
  const type = el.type;
  if (typeof type !== "string" || !ELEMENT_TYPES.has(type)) {
    errors.push(`${path}.type 必须是 ${[...ELEMENT_TYPES].join("|")} 之一`);
    return;
  }

  if (typeof el.label === "string" && el.label.length > 200) {
    errors.push(`${path}.label 过长（≤200 字符）`);
  }

  switch (type) {
    case "point":
      requireNumber(el.x, `${path}.x`, errors);
      requireNumber(el.y, `${path}.y`, errors);
      break;
    case "line":
    case "vector":
      requireVec2(el.from, `${path}.from`, errors);
      requireVec2(el.to, `${path}.to`, errors);
      break;
    case "triangle":
      if (!Array.isArray(el.vertices) || el.vertices.length !== 3) {
        errors.push(`${path}.vertices 必须是 3 个顶点`);
      } else {
        el.vertices.forEach((v, i) => requireVec2(v, `${path}.vertices[${i}]`, errors));
      }
      break;
    case "polygon":
      if (!Array.isArray(el.points) || el.points.length < 3) {
        errors.push(`${path}.points 必须 ≥3 个顶点`);
      } else {
        el.points.forEach((p, i) => requireVec2(p, `${path}.points[${i}]`, errors));
      }
      break;
    case "circle":
      requireVec2(el.center, `${path}.center`, errors);
      requireNumber(el.radius, `${path}.radius`, errors);
      if (typeof el.radius === "number" && !(el.radius > 0)) {
        errors.push(`${path}.radius 必须是正数`);
      }
      break;
    case "arc":
      requireVec2(el.center, `${path}.center`, errors);
      requireNumber(el.radius, `${path}.radius`, errors);
      requireNumber(el.startAngle, `${path}.startAngle`, errors);
      requireNumber(el.endAngle, `${path}.endAngle`, errors);
      if (typeof el.radius === "number" && !(el.radius > 0)) {
        errors.push(`${path}.radius 必须是正数`);
      }
      break;
    case "angle":
      requireVec2(el.vertex, `${path}.vertex`, errors);
      requireVec2(el.from, `${path}.from`, errors);
      requireVec2(el.to, `${path}.to`, errors);
      if (el.radius !== undefined) requireNumber(el.radius, `${path}.radius`, errors);
      if (el.degrees !== undefined) requireNumber(el.degrees, `${path}.degrees`, errors);
      break;
    case "functionCurve":
      if (typeof el.expr !== "string" || el.expr.trim().length === 0) {
        errors.push(`${path}.expr 必须是非空字符串`);
      }
      if (el.xRange !== undefined) validateRange(el.xRange, `${path}.xRange`, errors);
      if (typeof el.samples === "number" && (!Number.isInteger(el.samples) || el.samples < 2)) {
        errors.push(`${path}.samples 必须是 ≥2 的整数`);
      }
      break;
    case "label":
      requireNumber(el.x, `${path}.x`, errors);
      requireNumber(el.y, `${path}.y`, errors);
      if (typeof el.text !== "string" || el.text.trim().length === 0) {
        errors.push(`${path}.text 必须是非空字符串`);
      }
      break;
  }
}

function requireNumber(value: unknown, path: string, errors: string[]): void {
  if (!isFiniteNumber(value)) errors.push(`${path} 必须是有限数字`);
}

function requireVec2(value: unknown, path: string, errors: string[]): void {
  if (!Array.isArray(value) || value.length !== 2) {
    errors.push(`${path} 必须是 [x, y]`);
    return;
  }
  if (!isFiniteNumber(value[0]) || !isFiniteNumber(value[1])) {
    errors.push(`${path} 的坐标必须是有限数字`);
  }
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
