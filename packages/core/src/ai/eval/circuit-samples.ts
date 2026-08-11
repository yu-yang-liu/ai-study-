import type { CircuitBlock } from '../structured/schemas';

/** circuit task 人工标注样本（首版 7 例，含 1 个负例）。 */
export interface CircuitEvalCase {
  id: string;
  question: string;
  expected: CircuitBlock | null;
}

export const circuitSamples: CircuitEvalCase[] = [
  {
    id: 'circuit-01-series-bulb',
    question: '画一个由电池、开关和灯泡组成的串联电路。',
    expected: {
      type: 'circuit',
      title: '串联电路',
      nodes: [
        { id: 'b1', type: 'battery', x: 0, y: 0, value: '6V' },
        { id: 's1', type: 'switch', x: 8, y: 0, open: false },
        { id: 'l1', type: 'bulb', x: 16, y: 0 },
      ],
      wires: [
        { from: 'b1', to: 's1' },
        { from: 's1', to: 'l1' },
        { from: 'l1', to: 'b1' },
      ],
    },
  },
  {
    id: 'circuit-02-two-bulbs-series',
    question: '两个灯泡 L1、L2 与电源串联，画出电路图。',
    expected: {
      type: 'circuit',
      title: '两灯泡串联',
      nodes: [
        { id: 'b1', type: 'battery', x: 0, y: 0 },
        { id: 'l1', type: 'bulb', x: 8, y: 0, label: 'L1' },
        { id: 'l2', type: 'bulb', x: 16, y: 0, label: 'L2' },
      ],
      wires: [
        { from: 'b1', to: 'l1' },
        { from: 'l1', to: 'l2' },
        { from: 'l2', to: 'b1' },
      ],
    },
  },
  {
    id: 'circuit-03-parallel',
    question: '两个灯泡并联后接在电源两端，画出电路图。',
    expected: {
      type: 'circuit',
      title: '两灯泡并联',
      nodes: [
        { id: 'b1', type: 'battery', x: 0, y: 0 },
        { id: 'j1', type: 'wire', x: 6, y: 4 },
        { id: 'j2', type: 'wire', x: 6, y: -4 },
        { id: 'l1', type: 'bulb', x: 12, y: 4, label: 'L1' },
        { id: 'l2', type: 'bulb', x: 12, y: -4, label: 'L2' },
      ],
      wires: [
        { from: 'b1', to: 'j1' },
        { from: 'b1', to: 'j2' },
        { from: 'j1', to: 'l1' },
        { from: 'j2', to: 'l2' },
        { from: 'l1', to: 'l2' },
      ],
    },
  },
  {
    id: 'circuit-04-ohm-method',
    question: '用伏安法测量未知电阻 Rx：电池、开关、电阻 Rx、电流表串联，电压表并联在 Rx 两端，画出电路图。',
    expected: {
      type: 'circuit',
      title: '伏安法测电阻',
      nodes: [
        { id: 'b1', type: 'battery', x: 0, y: 0 },
        { id: 's1', type: 'switch', x: 6, y: 0, open: false },
        { id: 'a1', type: 'ammeter', x: 12, y: 0 },
        { id: 'r1', type: 'resistor', x: 18, y: 0, label: 'Rx' },
        { id: 'v1', type: 'voltmeter', x: 18, y: 6 },
      ],
      wires: [
        { from: 'b1', to: 's1' },
        { from: 's1', to: 'a1' },
        { from: 'a1', to: 'r1' },
        { from: 'r1', to: 'b1' },
        { from: 'r1', to: 'v1' },
        { from: 'v1', to: 'b1' },
      ],
    },
  },
  {
    id: 'circuit-05-rheostat',
    question: '滑动变阻器与灯泡串联后接在电源两端，画出电路图。',
    expected: {
      type: 'circuit',
      title: '滑动变阻器与灯泡串联',
      nodes: [
        { id: 'b1', type: 'battery', x: 0, y: 0 },
        { id: 'r1', type: 'rheostat', x: 8, y: 0 },
        { id: 'l1', type: 'bulb', x: 16, y: 0 },
      ],
      wires: [
        { from: 'b1', to: 'r1' },
        { from: 'r1', to: 'l1' },
        { from: 'l1', to: 'b1' },
      ],
    },
  },
  {
    id: 'circuit-06-motor-switch',
    question: '电池、开关和电动机组成的简单电路，画出电路图。',
    expected: {
      type: 'circuit',
      title: '电动机电路',
      nodes: [
        { id: 'b1', type: 'battery', x: 0, y: 0 },
        { id: 's1', type: 'switch', x: 8, y: 0, open: false },
        { id: 'm1', type: 'motor', x: 16, y: 0 },
      ],
      wires: [
        { from: 'b1', to: 's1' },
        { from: 's1', to: 'm1' },
        { from: 'm1', to: 'b1' },
      ],
    },
  },
  {
    id: 'circuit-07-no-circuit',
    question: '欧姆定律的表达式是 I = U/R，请解释其含义。',
    expected: null,
  },
];
