import { computeBounds } from "./bounds.ts";
import { evaluateExpression } from "./expr.ts";
import type {
  AngleElement,
  ArcElement,
  CircleElement,
  CoordinateSystem,
  FunctionCurveElement,
  GeometryAST,
  GeometryElement,
  LabelElement,
  LineElement,
  PointElement,
  PolygonElement,
  SceneBounds,
  TriangleElement,
  Vec2,
  VectorElement,
} from "./types.ts";

/**
 * 渲染选项。
 */
export interface RenderOptions {
  /** 画布宽（px），缺省 640。 */
  width?: number;
  /** 画布高（px），缺省 480。 */
  height?: number;
  /** 内边距（px），缺省 28。 */
  padding?: number;
  /** 背景色，缺省白色。 */
  background?: string;
  /** 正文标注字号，缺省 15。 */
  fontSize?: number;
  /** 坐标轴刻度字号，缺省 12。 */
  axisFontSize?: number;
}

interface Transformer {
  scale: number;
  offsetX: number;
  offsetY: number;
  mx: (x: number) => number;
  my: (y: number) => number;
}

const DEFAULT_COLOR = "#1f2937";
const AXIS_COLOR = "#94a3b8";
const GRID_COLOR = "#e2e8f0";
const CURVE_COLOR = "#2563eb";
const ANGLE_FILL = "rgba(245, 158, 11, 0.25)";

/**
 * 将 Geometry AST 渲染为 SVG 字符串（纯函数、零 DOM 依赖）。
 *
 * 渲染器负责：
 * 1. 边界计算（显式 bounds / 坐标轴范围 / 元素自动适配）；
 * 2. 数学坐标（y 向上）→ SVG 屏幕坐标（y 向下）映射，等比缩放居中；
 * 3. 每个元素类型的独立 drawer。
 */
export function renderSVG(ast: GeometryAST, opts?: RenderOptions): string {
  const width = opts?.width ?? 640;
  const height = opts?.height ?? 480;
  const padding = opts?.padding ?? 28;
  const background = opts?.background ?? "#ffffff";
  const fontSize = opts?.fontSize ?? 15;
  const axisFontSize = opts?.axisFontSize ?? 12;

  const bounds = expandDegenerate(computeBounds(ast));
  const t = buildTransformer(bounds, width, height, padding);
  const parts: string[] = [];

  parts.push(rect(0, 0, width, height, background));

  if (ast.type === "coordinateSystem") {
    drawCoordinateSystem(ast, t, parts, width, axisFontSize);
  }

  const elements = ast.type === "coordinateSystem" ? ast.children : ast.elements;
  const ordered = [...elements].sort((a, b) => elementPriority(a) - elementPriority(b));
  for (const el of ordered) {
    if (el.visible === false) continue;
    switch (el.type) {
      case "polygon":
        drawPolygon(el, t, parts, fontSize);
        break;
      case "triangle":
        drawTriangle(el, t, parts, fontSize);
        break;
      case "line":
        drawLine(el, t, parts);
        break;
      case "vector":
        drawVector(el, t, parts);
        break;
      case "circle":
        drawCircle(el, t, parts);
        break;
      case "functionCurve":
        drawFunctionCurve(el, t, parts);
        break;
      case "arc":
        drawArc(el, t, parts);
        break;
      case "angle":
        drawAngle(el, t, parts, fontSize);
        break;
      case "point":
        drawPoint(el, t, parts, fontSize);
        break;
      case "label":
        drawLabel(el, t, parts, fontSize);
        break;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" role="img" aria-label="${esc(ast.type)}">` +
    parts.join("") +
    "</svg>"
  );
}

// ---------------------------------------------------------------------------
// 坐标变换
// ---------------------------------------------------------------------------

function buildTransformer(bounds: SceneBounds, width: number, height: number, padding: number): Transformer {
  const bw = bounds.xMax - bounds.xMin;
  const bh = bounds.yMax - bounds.yMin;
  const scale = Math.min((width - 2 * padding) / bw, (height - 2 * padding) / bh);
  const offsetX = (width - bw * scale) / 2;
  const offsetY = (height - bh * scale) / 2;
  return {
    scale,
    offsetX,
    offsetY,
    mx: (x: number) => offsetX + (x - bounds.xMin) * scale,
    my: (y: number) => offsetY + (bounds.yMax - y) * scale,
  };
}

function expandDegenerate(bounds: SceneBounds): SceneBounds {
  let { xMin, yMin, xMax, yMax } = bounds;
  if (xMax - xMin < 1e-6) {
    xMin -= 0.5;
    xMax += 0.5;
  }
  if (yMax - yMin < 1e-6) {
    yMin -= 0.5;
    yMax += 0.5;
  }
  return { xMin, yMin, xMax, yMax };
}

// ---------------------------------------------------------------------------
// 绘制顺序
// ---------------------------------------------------------------------------

function elementPriority(el: GeometryElement): number {
  switch (el.type) {
    case "polygon":
    case "triangle":
      return 0;
    case "line":
    case "vector":
    case "circle":
      return 1;
    case "functionCurve":
      return 2;
    case "arc":
    case "angle":
      return 3;
    case "point":
      return 4;
    case "label":
      return 5;
  }
}

// ---------------------------------------------------------------------------
// 坐标轴 / 网格
// ---------------------------------------------------------------------------

function drawCoordinateSystem(
  ast: CoordinateSystem,
  t: Transformer,
  parts: string[],
  width: number,
  axisFontSize: number,
): void {
  const { xRange, yRange, showGrid, xStep, yStep } = ast;
  const xMin = xRange[0];
  const xMax = xRange[1];
  const yMin = yRange[0];
  const yMax = yRange[1];

  // 网格
  if (showGrid) {
    const gx = xStep ?? niceStep(xMin, xMax, width / 70);
    for (let x = Math.ceil(xMin / gx) * gx; x <= xMax; x += gx) {
      if (Math.abs(x) < 1e-9) continue;
      parts.push(`<line x1="${num(t.mx(x))}" y1="${num(t.my(yMin))}" x2="${num(t.mx(x))}" y2="${num(t.my(yMax))}" stroke="${GRID_COLOR}" stroke-width="1"/>`);
    }
    const gy = yStep ?? niceStep(yMin, yMax, heightPx(t));
    for (let y = Math.ceil(yMin / gy) * gy; y <= yMax; y += gy) {
      if (Math.abs(y) < 1e-9) continue;
      parts.push(`<line x1="${num(t.mx(xMin))}" y1="${num(t.my(y))}" x2="${num(t.mx(xMax))}" y2="${num(t.my(y))}" stroke="${GRID_COLOR}" stroke-width="1"/>`);
    }
  }

  // 坐标轴
  const xAxisY = t.my(0);
  const yAxisX = t.mx(0);
  const xAxisVisible = yMin < 0 && yMax > 0;
  const yAxisVisible = xMin < 0 && xMax > 0;

  if (xAxisVisible) {
    parts.push(`<line x1="${num(t.mx(xMin))}" y1="${num(xAxisY)}" x2="${num(t.mx(xMax))}" y2="${num(xAxisY)}" stroke="${AXIS_COLOR}" stroke-width="1.2"/>`);
    parts.push(arrowHead(t.mx(xMax), xAxisY, Math.PI, AXIS_COLOR, 9));
  }
  if (yAxisVisible) {
    parts.push(`<line x1="${num(yAxisX)}" y1="${num(t.my(yMin))}" x2="${num(yAxisX)}" y2="${num(t.my(yMax))}" stroke="${AXIS_COLOR}" stroke-width="1.2"/>`);
    parts.push(arrowHead(yAxisX, t.my(yMax), -Math.PI / 2, AXIS_COLOR, 9));
  }

  // 刻度
  if (xAxisVisible) {
    const gx = xStep ?? niceStep(xMin, xMax, width / 70);
    for (let x = Math.ceil(xMin / gx) * gx; x <= xMax; x += gx) {
      if (Math.abs(x) < 1e-9) continue;
      const sx = num(t.mx(x));
      parts.push(`<line x1="${sx}" y1="${num(xAxisY - 3)}" x2="${sx}" y2="${num(xAxisY + 3)}" stroke="${AXIS_COLOR}" stroke-width="1"/>`);
      parts.push(`<text x="${sx}" y="${num(xAxisY + axisFontSize + 6)}" text-anchor="middle" font-size="${axisFontSize}" fill="${AXIS_COLOR}">${esc(formatTick(x))}</text>`);
    }
    parts.push(`<text x="${num(t.mx(xMax))}" y="${num(xAxisY - axisFontSize - 4)}" text-anchor="end" font-size="${axisFontSize}" fill="${AXIS_COLOR}">x</text>`);
  }
  if (yAxisVisible) {
    const gy = yStep ?? niceStep(yMin, yMax, heightPx(t));
    for (let y = Math.ceil(yMin / gy) * gy; y <= yMax; y += gy) {
      if (Math.abs(y) < 1e-9) continue;
      const sy = num(t.my(y));
      parts.push(`<line x1="${num(yAxisX - 3)}" y1="${sy}" x2="${num(yAxisX + 3)}" y2="${sy}" stroke="${AXIS_COLOR}" stroke-width="1"/>`);
      parts.push(`<text x="${num(yAxisX - 6)}" y="${sy}" text-anchor="end" dominant-baseline="middle" font-size="${axisFontSize}" fill="${AXIS_COLOR}">${esc(formatTick(y))}</text>`);
    }
    parts.push(`<text x="${num(yAxisX + axisFontSize + 4)}" y="${num(t.my(yMax))}" text-anchor="start" font-size="${axisFontSize}" fill="${AXIS_COLOR}">y</text>`);
  }
}

/** 选择视觉舒适的刻度步长：1/2/2.5/5 × 10^k。 */
function niceStep(min: number, max: number, targetCount: number): number {
  const raw = Math.max((max - min) / Math.max(targetCount, 1), 1e-9);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const candidates = [1, 2, 2.5, 5, 10];
  for (const c of candidates) {
    if (raw <= c * pow) return c * pow;
  }
  return 10 * pow;
}

function formatTick(v: number): string {
  const abs = Math.abs(v);
  return abs >= 100 || Math.round(v) === v ? String(Math.round(v)) : String(Math.round(v * 10) / 10);
}

function heightPx(t: Transformer): number {
  return t.scale > 0 ? 70 / t.scale : 70;
}

// ---------------------------------------------------------------------------
// 元素 drawer
// ---------------------------------------------------------------------------

function drawPoint(el: PointElement, t: Transformer, parts: string[], fontSize: number): void {
  const cx = t.mx(el.x);
  const cy = t.my(el.y);
  const color = el.color ?? DEFAULT_COLOR;
  parts.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="4" fill="${color}" stroke="#ffffff" stroke-width="1.2"/>`);
  if (el.label) {
    parts.push(text(cx + 7, cy - 7, el.label, color, fontSize, "start"));
  }
}

function drawLine(el: LineElement, t: Transformer, parts: string[]): void {
  const color = el.color ?? DEFAULT_COLOR;
  const dash = el.style === "dashed" ? ` stroke-dasharray="6 4"` : "";
  parts.push(
    `<line x1="${num(t.mx(el.from[0]))}" y1="${num(t.my(el.from[1]))}" x2="${num(t.mx(el.to[0]))}" y2="${num(t.my(el.to[1]))}" stroke="${color}" stroke-width="1.5"${dash}/>`,
  );
  if (el.label) {
    const mx = (el.from[0] + el.to[0]) / 2;
    const my = (el.from[1] + el.to[1]) / 2;
    parts.push(text(t.mx(mx), t.my(my) - 8, el.label, color, 13, "middle"));
  }
}

function drawVector(el: VectorElement, t: Transformer, parts: string[]): void {
  const color = el.color ?? "#dc2626";
  const x1 = t.mx(el.from[0]);
  const y1 = t.my(el.from[1]);
  const x2 = t.mx(el.to[0]);
  const y2 = t.my(el.to[1]);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const dirX = dx / len;
  const dirY = dy / len;
  const size = Math.min(18, Math.max(9, len * 0.22));
  const tipX = x2 - dirX * 3;
  const tipY = y2 - dirY * 3;
  const bx = tipX - dirX * size;
  const by = tipY - dirY * size;
  const px = -dirY * size * 0.45;
  const py = dirX * size * 0.45;
  parts.push(`<line x1="${num(x1)}" y1="${num(y1)}" x2="${num(tipX)}" y2="${num(tipY)}" stroke="${color}" stroke-width="2"/>`);
  parts.push(`<polygon points="${num(bx + px)},${num(by + py)} ${num(bx - px)},${num(by - py)} ${num(tipX)},${num(tipY)}" fill="${color}"/>`);
  if (el.label) {
    parts.push(text((x1 + x2) / 2 + 8, (y1 + y2) / 2 - 8, el.label, color, 14, "start"));
  }
}

function drawTriangle(el: TriangleElement, t: Transformer, parts: string[], fontSize: number): void {
  const pts = el.vertices.map((v) => `${num(t.mx(v[0]))},${num(t.my(v[1]))}`);
  const color = el.color ?? DEFAULT_COLOR;
  parts.push(`<polygon points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`);
  if (el.labels) {
    const cx = (el.vertices[0][0] + el.vertices[1][0] + el.vertices[2][0]) / 3;
    const cy = (el.vertices[0][1] + el.vertices[1][1] + el.vertices[2][1]) / 3;
    el.vertices.forEach((v, i) => {
      const label = el.labels?.[i];
      if (!label) return;
      const [lx, ly] = labelOffsetScreen(t.mx(v[0]), t.my(v[1]), t.mx(cx), t.my(cy), 18);
      parts.push(text(lx, ly, label, color, fontSize, "middle"));
    });
  }
}

function drawPolygon(el: PolygonElement, t: Transformer, parts: string[], fontSize: number): void {
  const pts = el.points.map((p) => `${num(t.mx(p[0]))},${num(t.my(p[1]))}`);
  const color = el.color ?? DEFAULT_COLOR;
  parts.push(`<polygon points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round"/>`);
  if (el.labels && el.labels.length === el.points.length) {
    const cx = el.points.reduce((s, p) => s + p[0], 0) / el.points.length;
    const cy = el.points.reduce((s, p) => s + p[1], 0) / el.points.length;
    el.points.forEach((p, i) => {
      const label = el.labels?.[i];
      if (!label) return;
      const [lx, ly] = labelOffsetScreen(t.mx(p[0]), t.my(p[1]), t.mx(cx), t.my(cy), 18);
      parts.push(text(lx, ly, label, color, fontSize, "middle"));
    });
  }
}

function drawCircle(el: CircleElement, t: Transformer, parts: string[]): void {
  const color = el.color ?? DEFAULT_COLOR;
  const fill = el.fill === "light" ? "rgba(59, 130, 246, 0.08)" : "none";
  parts.push(`<circle cx="${num(t.mx(el.center[0]))}" cy="${num(t.my(el.center[1]))}" r="${num(el.radius * t.scale)}" fill="${fill}" stroke="${color}" stroke-width="1.5"/>`);
  if (el.label) {
    parts.push(text(t.mx(el.center[0]) + el.radius * t.scale + 6, t.my(el.center[1]) - 6, el.label, color, 14, "start"));
  }
}

function drawArc(el: ArcElement, t: Transformer, parts: string[]): void {
  const color = el.color ?? DEFAULT_COLOR;
  const path = arcPath(el.center, el.radius, el.startAngle, el.endAngle, t, 48);
  if (path) parts.push(`<path d="${path}" fill="none" stroke="${color}" stroke-width="1.5"/>`);
  if (el.label) {
    const mid = (el.startAngle + el.endAngle) / 2;
    const rad = (mid * Math.PI) / 180;
    const lx = el.center[0] + Math.cos(rad) * el.radius * 1.15;
    const ly = el.center[1] + Math.sin(rad) * el.radius * 1.15;
    parts.push(text(t.mx(lx), t.my(ly), el.label, color, 14, "middle"));
  }
}

function drawAngle(el: AngleElement, t: Transformer, parts: string[], fontSize: number): void {
  const color = el.color ?? "#d97706";
  const aFrom = angleDeg(el.from, el.vertex);
  const aTo = angleDeg(el.to, el.vertex);
  let start = aFrom;
  let end = aTo;
  let delta = ((aTo - aFrom) % 360 + 360) % 360;
  if (delta > 180) {
    // 取小于 180° 的一侧（典型几何角标注）
    start = aTo;
    end = aFrom;
    delta = 360 - delta;
  }
  if (delta < 1) return;

  const d1 = dist(el.vertex, el.from);
  const d2 = dist(el.vertex, el.to);
  const radius = el.radius ?? Math.max(Math.min(d1, d2) * 0.25, 0.25);
  const path = arcPath(el.vertex, radius, start, end, t, 36);
  if (path) {
    // 角标记：弧线闭合到顶点，形成可填充的扇形
    const vertexPx = `${num(t.mx(el.vertex[0]))},${num(t.my(el.vertex[1]))}`;
    parts.push(`<path d="${path} L ${vertexPx} Z" fill="${ANGLE_FILL}" stroke="${color}" stroke-width="1.2" stroke-linejoin="round"/>`);
  }
  if (el.degrees !== undefined || el.label) {
    const mid = start + delta / 2;
    const rad = (mid * Math.PI) / 180;
    const lx = el.vertex[0] + Math.cos(rad) * radius * 1.3;
    const ly = el.vertex[1] + Math.sin(rad) * radius * 1.3;
    const content = el.degrees !== undefined ? `${formatTick(el.degrees)}°` : (el.label ?? "");
    if (content) {
      parts.push(text(t.mx(lx), t.my(ly), content, color, Math.max(fontSize - 2, 11), "middle"));
    }
  }
}

function drawFunctionCurve(el: FunctionCurveElement, t: Transformer, parts: string[]): void {
  const [xMin, xMax] = el.xRange ?? [-5, 5];
  const samples = el.samples && el.samples >= 2 ? el.samples : 160;
  const color = el.color ?? CURVE_COLOR;
  const points: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const x = xMin + ((xMax - xMin) * i) / samples;
    const y = evaluateExpression(el.expr, x);
    if (y === null || !Number.isFinite(y)) continue;
    points.push(`${num(t.mx(x))},${num(t.my(y))}`);
  }
  if (points.length < 2) return;
  parts.push(`<polyline points="${points.join(" ")}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round"/>`);
  if (el.label) {
    const last = points[points.length - 1].split(",");
    parts.push(text(Number(last[0]) - 4, Number(last[1]) - 8, el.label, color, 14, "end"));
  }
}

function drawLabel(el: LabelElement, t: Transformer, parts: string[], fontSize: number): void {
  const color = el.color ?? DEFAULT_COLOR;
  const anchor = el.anchor ?? "start";
  parts.push(text(t.mx(el.x), t.my(el.y), el.text, color, fontSize, anchor));
}

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function text(x: number, y: number, content: string, fill: string, size: number, anchor: string): string {
  return `<text x="${num(x)}" y="${num(y)}" text-anchor="${anchor}" dominant-baseline="middle" font-size="${size}" fill="${fill}">${esc(content)}</text>`;
}

function rect(x: number, y: number, w: number, h: number, fill: string): string {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
}

function arrowHead(x: number, y: number, angle: number, fill: string, size: number): string {
  const tipX = x + Math.cos(angle) * size;
  const tipY = y + Math.sin(angle) * size;
  const bx = x - Math.cos(angle) * size;
  const by = y - Math.sin(angle) * size;
  const px = -Math.sin(angle) * size * 0.45;
  const py = Math.cos(angle) * size * 0.45;
  return `<polygon points="${num(bx + px)},${num(by + py)} ${num(bx - px)},${num(by - py)} ${num(tipX)},${num(tipY)}" fill="${fill}"/>`;
}

/** 从 startAngle 到 endAngle（度，逆时针）的折线路径。 */
function arcPath(
  center: Vec2,
  radius: number,
  startAngle: number,
  endAngle: number,
  t: Transformer,
  segments: number,
): string | null {
  if (radius <= 0 || segments < 2) return null;
  const start = startAngle * (Math.PI / 180);
  const end = endAngle * (Math.PI / 180);
  const pts: string[] = [];
  for (let i = 0; i <= segments; i++) {
    const a = start + ((end - start) * i) / segments;
    const x = center[0] + Math.cos(a) * radius;
    const y = center[1] + Math.sin(a) * radius;
    pts.push(`${num(t.mx(x))},${num(t.my(y))}`);
  }
  return `M ${pts[0]} L ${pts.slice(1).join(" L ")}`;
}

function angleDeg(p: Vec2, origin: Vec2): number {
  return (Math.atan2(p[1] - origin[1], p[0] - origin[0]) * 180) / Math.PI;
}

function dist(a: Vec2, b: Vec2): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** 屏幕坐标下，顶点标注沿「顶点 → 质心」反方向偏移 px 像素。 */
function labelOffsetScreen(vx: number, vy: number, cx: number, cy: number, px: number): [number, number] {
  const dx = vx - cx;
  const dy = vy - cy;
  const len = Math.hypot(dx, dy) || 1;
  return [vx + (dx / len) * px, vy + (dy / len) * px];
}

function num(v: number): string {
  return String(Math.round(v * 100) / 100);
}

function esc(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
