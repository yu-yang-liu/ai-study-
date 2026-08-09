/**
 * Geometry AST v1 —— 数学 / 物理 / 化学示意图的结构化协议（AI → AST → Renderer）。
 *
 * 设计原则（对齐 docs/VISUAL_AST.md）：
 * - 图像不是图片，而是结构化数据；禁止图片 URL / TikZ / UI 代码。
 * - 坐标系为数学坐标：x 向右，y 向上，原点缺省 (0, 0)。
 * - 角度单位为「度」，逆时针为正。
 * - 渲染器负责数学坐标 ↔ 屏幕坐标映射与自适应适配。
 */

/** 场景边界（数学坐标）。 */
export interface SceneBounds {
  xMin: number;
  yMin: number;
  xMax: number;
  yMax: number;
}

/** 二维坐标点（数学坐标）。 */
export type Vec2 = [number, number];

/** 所有元素的公共字段。 */
export interface ElementBase {
  /** 元素标注文本（顶点字母 / 中文说明等）。 */
  label?: string;
  /** CSS 颜色，如 "#2563eb"、"red"。 */
  color?: string;
  /** 是否渲染该元素，缺省 true。 */
  visible?: boolean;
}

/** 点。 */
export interface PointElement extends ElementBase {
  type: "point";
  x: number;
  y: number;
}

/** 线段。 */
export interface LineElement extends ElementBase {
  type: "line";
  from: Vec2;
  to: Vec2;
  /** 线型，缺省 solid。 */
  style?: "solid" | "dashed";
}

/** 带箭头的向量（力学示意图、位移等）。 */
export interface VectorElement extends ElementBase {
  type: "vector";
  from: Vec2;
  to: Vec2;
}

/** 三角形（三个顶点，可选顶点标注）。 */
export interface TriangleElement extends ElementBase {
  type: "triangle";
  vertices: [Vec2, Vec2, Vec2];
  labels?: [string, string, string];
}

/** 多边形（≥3 个顶点，可选顶点标注）。 */
export interface PolygonElement extends ElementBase {
  type: "polygon";
  points: Vec2[];
  labels?: string[];
}

/** 圆。 */
export interface CircleElement extends ElementBase {
  type: "circle";
  center: Vec2;
  radius: number;
  /** 填充：none（默认）/ light（浅色半透明填充，用于面区域）。 */
  fill?: "none" | "light";
}

/** 圆弧（角度单位为度，从 startAngle 逆时针到 endAngle）。 */
export interface ArcElement extends ElementBase {
  type: "arc";
  center: Vec2;
  radius: number;
  startAngle: number;
  endAngle: number;
}

/**
 * 角标记：由 vertex / from / to 三点自动画角弧，可选标注度数。
 * 渲染器取 from、to 两点相对 vertex 的张角（取小于 180° 的一侧）。
 */
export interface AngleElement extends ElementBase {
  type: "angle";
  vertex: Vec2;
  from: Vec2;
  to: Vec2;
  /** 角弧半径（数学坐标单位），缺省按两边长度的 25% 自动推算。 */
  radius?: number;
  /** 度数标注，如 60。 */
  degrees?: number;
}

/**
 * 函数曲线：expr 为初等函数表达式子集（+ - * / ^ 与
 * sqrt/sin/cos/tan/abs/log/ln/exp 等，变量 x），xRange 缺省 [-5, 5]。
 */
export interface FunctionCurveElement extends ElementBase {
  type: "functionCurve";
  expr: string;
  xRange?: [number, number];
  /** 采样点数，缺省 160。 */
  samples?: number;
}

/** 独立文字标注（锚点由 anchor 控制）。 */
export interface LabelElement extends ElementBase {
  type: "label";
  x: number;
  y: number;
  text: string;
  anchor?: "start" | "middle" | "end";
}

/** Geometry AST v1 元素联合。 */
export type GeometryElement =
  | PointElement
  | LineElement
  | VectorElement
  | TriangleElement
  | PolygonElement
  | CircleElement
  | ArcElement
  | AngleElement
  | FunctionCurveElement
  | LabelElement;

/** 平面直角坐标系容器。 */
export interface CoordinateSystem {
  type: "coordinateSystem";
  xRange: [number, number];
  yRange: [number, number];
  /** 刻度步长（可选，缺省自动取整）。 */
  xStep?: number;
  yStep?: number;
  /** 是否显示网格，缺省 false。 */
  showGrid?: boolean;
  children: GeometryElement[];
}

/** 自由场景容器（无坐标轴，如平面几何 / 力学示意图）。 */
export interface Scene {
  type: "scene";
  elements: GeometryElement[];
  /** 可选边界；缺省由渲染器根据元素自动适配。 */
  bounds?: SceneBounds;
}

/** Geometry AST v1 根节点。 */
export type GeometryAST = Scene | CoordinateSystem;
