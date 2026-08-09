import type { GeometryAST } from "./types.ts";

/**
 * 内置示例：覆盖 v1 主要元素类型，同时作为 AI 输出质量评估的基准样例。
 */
export const samples: Record<string, GeometryAST> = {
  /** 平面几何：三角形 + 角标注 */
  triangleWithAngle: {
    type: "scene",
    elements: [
      {
        type: "triangle",
        vertices: [
          [0, 0],
          [5, 0],
          [2, 3.5],
        ],
        labels: ["A", "B", "C"],
      },
      {
        type: "angle",
        vertex: [0, 0],
        from: [5, 0],
        to: [2, 3.5],
        degrees: 60,
      },
    ],
  },

  /** 解析几何：坐标系 + 二次函数曲线 + 一次函数直线 */
  coordinateParabola: {
    type: "coordinateSystem",
    xRange: [-3, 3],
    yRange: [-1, 6],
    showGrid: true,
    children: [
      {
        type: "functionCurve",
        expr: "x^2",
        label: "y=x²",
      },
      {
        type: "functionCurve",
        expr: "x + 2",
        color: "#dc2626",
        label: "y=x+2",
      },
    ],
  },

  /** 圆与内接三角形：圆心、半径、辅助虚线 */
  circleInscribedTriangle: {
    type: "scene",
    elements: [
      {
        type: "circle",
        center: [0, 0],
        radius: 2.5,
      },
      {
        type: "triangle",
        vertices: [
          [2.5, 0],
          [-1.25, 2.165],
          [-1.25, -2.165],
        ],
        labels: ["A", "B", "C"],
      },
      {
        type: "point",
        x: 0,
        y: 0,
        label: "O",
      },
      {
        type: "line",
        from: [0, 0],
        to: [2.5, 0],
        style: "dashed",
      },
      {
        type: "line",
        from: [0, 0],
        to: [-1.25, 2.165],
        style: "dashed",
      },
      {
        type: "line",
        from: [0, 0],
        to: [-1.25, -2.165],
        style: "dashed",
      },
    ],
  },

  /** 物理：力的合成（向量 + 平行四边形辅助线） */
  forceDiagram: {
    type: "scene",
    elements: [
      {
        type: "point",
        x: 0,
        y: 0,
        label: "O",
      },
      {
        type: "vector",
        from: [0, 0],
        to: [3, 0],
        label: "F₁",
      },
      {
        type: "vector",
        from: [0, 0],
        to: [1.5, 2.6],
        label: "F₂",
      },
      {
        type: "line",
        from: [3, 0],
        to: [4.5, 2.6],
        style: "dashed",
      },
      {
        type: "line",
        from: [1.5, 2.6],
        to: [4.5, 2.6],
        style: "dashed",
      },
      {
        type: "vector",
        from: [0, 0],
        to: [4.5, 2.6],
        color: "#2563eb",
        label: "F合",
      },
    ],
  },

  /** 直角三角形：90° 角标注 */
  rightTriangle: {
    type: "scene",
    elements: [
      {
        type: "triangle",
        vertices: [
          [0, 0],
          [4, 0],
          [0, 3],
        ],
        labels: ["A", "B", "C"],
      },
      {
        type: "angle",
        vertex: [0, 0],
        from: [4, 0],
        to: [0, 3],
        degrees: 90,
      },
    ],
  },
};

export type SampleName = keyof typeof samples;

export const sampleNames = Object.keys(samples) as SampleName[];
