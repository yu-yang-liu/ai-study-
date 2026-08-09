import type { GeometryAST } from '../structured/schemas';

/**
 * 几何 eval 人工标注样本（首版 8 例，含 1 个负例）。
 * 负例（expected === null）用于验证「不需要图形时输出 null」。
 */
export interface GeometryEvalCase {
  id: string;
  question: string;
  expected: GeometryAST | null;
}

export const geometrySamples: GeometryEvalCase[] = [
  {
    id: 'geometry-01-triangle-angle',
    question: '在三角形 ABC 中，∠A=60°，AB=5，AC=4，求 BC 的长。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'triangle', vertices: [[0, 0], [5, 0], [2, 3.5]], labels: ['A', 'B', 'C'] },
        { type: 'angle', vertex: [0, 0], from: [5, 0], to: [2, 3.5], degrees: 60 },
      ],
    },
  },
  {
    id: 'geometry-02-coordinate-parabola',
    question: '在同一坐标系中画出 y=x² 与 y=x+2 的图像。',
    expected: {
      type: 'coordinateSystem',
      xRange: [-3, 3],
      yRange: [-1, 6],
      showGrid: true,
      children: [
        { type: 'functionCurve', expr: 'x^2', label: 'y=x²' },
        { type: 'functionCurve', expr: 'x + 2', label: 'y=x+2' },
      ],
    },
  },
  {
    id: 'geometry-03-circle-inscribed',
    question: '圆 O 内接三角形 ABC，画出图形。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'circle', center: [0, 0], radius: 2.5 },
        { type: 'triangle', vertices: [[2.5, 0], [-1.25, 2.165], [-1.25, -2.165]], labels: ['A', 'B', 'C'] },
        { type: 'point', x: 0, y: 0, label: 'O' },
        { type: 'line', from: [0, 0], to: [2.5, 0], style: 'dashed' },
        { type: 'line', from: [0, 0], to: [-1.25, 2.165], style: 'dashed' },
        { type: 'line', from: [0, 0], to: [-1.25, -2.165], style: 'dashed' },
      ],
    },
  },
  {
    id: 'geometry-04-force-diagram',
    question: '物体受水平向右的力 F₁=3N 与另一个力 F₂（与 F₁ 成 60° 夹角）作用，画出合力合成的示意图。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'vector', from: [0, 0], to: [3, 0], label: 'F₁' },
        { type: 'vector', from: [0, 0], to: [1.5, 2.6], label: 'F₂' },
        { type: 'line', from: [3, 0], to: [4.5, 2.6], style: 'dashed' },
        { type: 'line', from: [1.5, 2.6], to: [4.5, 2.6], style: 'dashed' },
        { type: 'vector', from: [0, 0], to: [4.5, 2.6], label: 'F合' },
      ],
    },
  },
  {
    id: 'geometry-05-right-triangle',
    question: '直角三角形 ABC 中，∠A=90°，画出图形。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'triangle', vertices: [[0, 0], [4, 0], [0, 3]], labels: ['A', 'B', 'C'] },
        { type: 'angle', vertex: [0, 0], from: [4, 0], to: [0, 3], degrees: 90 },
      ],
    },
  },
  {
    id: 'geometry-06-linear-function',
    question: '一次函数 y=x+1 过点 (0,1) 与 (1,2)，画出图像并标注这两个点。',
    expected: {
      type: 'coordinateSystem',
      xRange: [-2, 3],
      yRange: [-1, 4],
      children: [
        { type: 'functionCurve', expr: 'x + 1' },
        { type: 'point', x: 0, y: 1, label: '(0,1)' },
        { type: 'point', x: 1, y: 2, label: '(1,2)' },
      ],
    },
  },
  {
    id: 'geometry-07-no-figure',
    question: '解方程 2x + 4 = 10。',
    expected: null,
  },
  {
    id: 'geometry-08-altitude',
    question: '在三角形 ABC 中作 BC 边上的高 AD，D 为垂足，画出图形。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'triangle', vertices: [[0, 0], [5, 0], [2, 3]], labels: ['A', 'B', 'C'] },
        { type: 'line', from: [2, 3], to: [2, 0], style: 'dashed' },
        { type: 'point', x: 2, y: 0, label: 'D' },
        { type: 'angle', vertex: [2, 0], from: [0, 0], to: [2, 3], degrees: 90 },
      ],
    },
  },
  {
    id: 'geometry-09-translation-equivalent',
    question: '画一个与 △ABC（A(1,1)、B(6,1)、C(3,4.5)）全等的三角形，位置不限。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'triangle', vertices: [[1, 1], [6, 1], [3, 4.5]], labels: ['A', 'B', 'C'] },
      ],
    },
  },
  {
    id: 'geometry-10-rotation-equivalent',
    question: '把 △ABC（A(1,1)、B(5,1)、C(3,4)）绕原点旋转 90° 后画出。',
    expected: {
      type: 'scene',
      elements: [
        { type: 'triangle', vertices: [[-1, 1], [-1, 5], [-4, 3]], labels: ['A', 'B', 'C'] },
      ],
    },
  },
  {
    id: 'geometry-11-scale-equivalent',
    question: '画一个半径 2.5 的圆，圆心位置不限。',
    expected: {
      type: 'scene',
      elements: [{ type: 'circle', center: [0, 0], radius: 2.5 }],
    },
  },
];
