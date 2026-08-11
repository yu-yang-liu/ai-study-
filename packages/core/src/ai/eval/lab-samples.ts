import type { LabBlock } from '../structured/schemas';

export interface LabEvalCase {
  id: string;
  question: string;
  expected: LabBlock | null;
}

export const labSamples: LabEvalCase[] = [
  {
    id: 'lab-01-oxygen-generation',
    question: '实验室用二氧化锰催化分解过氧化氢溶液制取氧气，画出该实验装置图（含排水集气）。',
    expected: {
      type: 'lab',
      title: '实验室制取氧气装置图',
      apparatus: [
        { id: 'a1', type: 'stand', x: 0, y: 0, label: '铁架台' },
        { id: 'a2', type: 'flask', x: 0, y: 8, content: 'H2O2溶液', label: '圆底烧瓶' },
        { id: 'a3', type: 'droppingFunnel', x: 0, y: 16, content: 'MnO2', label: '分液漏斗' },
        { id: 'a4', type: 'deliveryTube', x: 7, y: 8, orientation: 'horizontal', label: '导管' },
        { id: 'a5', type: 'gasBottle', x: 14, y: 6, content: 'O2', label: '集气瓶' },
        { id: 'a6', type: 'waterTrough', x: 14, y: 2, label: '水槽' },
      ],
      connections: [
        { from: 'a3', to: 'a2', kind: 'liquidFlow' },
        { from: 'a2', to: 'a4', kind: 'tube' },
        { from: 'a4', to: 'a5', kind: 'gasFlow' },
      ],
    },
  },
  {
    id: 'lab-02-distillation',
    question: '实验室蒸馏含少量水的乙醇，画出蒸馏装置图（含温度计与冷凝管）。',
    expected: {
      type: 'lab',
      title: '蒸馏装置图',
      apparatus: [
        { id: 'a1', type: 'stand', x: 0, y: 0, label: '铁架台' },
        { id: 'a2', type: 'flask', x: 0, y: 8, content: '乙醇', label: '圆底烧瓶' },
        { id: 'a3', type: 'thermometer', x: 0, y: 14, label: '温度计' },
        { id: 'a4', type: 'condenser', x: 10, y: 8, orientation: 'horizontal', label: '冷凝管' },
        { id: 'a5', type: 'erlenmeyerFlask', x: 20, y: 6, content: '馏出液', label: '锥形瓶' },
        { id: 'a6', type: 'clamp', x: 5, y: 10, label: '铁夹' },
        { id: 'a7', type: 'alcoholLamp', x: -4, y: -4, label: '酒精灯' },
      ],
      connections: [
        { from: 'a7', to: 'a2', kind: 'heat' },
        { from: 'a2', to: 'a4', kind: 'tube' },
        { from: 'a4', to: 'a5', kind: 'liquidFlow' },
      ],
    },
  },
  {
    id: 'lab-03-filtration',
    question: '实验室用过滤法分离不溶性固体与液体，画出过滤装置图。',
    expected: {
      type: 'lab',
      title: '过滤装置图',
      apparatus: [
        { id: 'a1', type: 'stand', x: 0, y: 0, label: '铁架台' },
        { id: 'a2', type: 'funnel', x: 0, y: 8, label: '漏斗' },
        { id: 'a3', type: 'filterPaper', x: 0, y: 6, label: '滤纸' },
        { id: 'a4', type: 'beaker', x: 0, y: 0, content: '滤液', label: '烧杯' },
        { id: 'a5', type: 'glassRod', x: 5, y: 10, orientation: 'left', label: '玻璃棒' },
      ],
      connections: [{ from: 'a2', to: 'a4', kind: 'liquidFlow' }],
    },
  },
  {
    id: 'lab-04-extraction-separation',
    question: '实验室用四氯化碳萃取碘水中的碘，画出萃取分液装置图。',
    expected: {
      type: 'lab',
      title: '萃取分液装置图',
      apparatus: [
        { id: 'a1', type: 'stand', x: 0, y: 0, label: '铁架台' },
        { id: 'a2', type: 'separatoryFunnel', x: 0, y: 8, content: '碘水', label: '分液漏斗' },
        { id: 'a3', type: 'beaker', x: 0, y: 0, content: '下层液体', label: '烧杯' },
      ],
      connections: [{ from: 'a2', to: 'a3', kind: 'liquidFlow' }],
    },
  },
  {
    id: 'lab-05-no-diagram',
    question: '化学反应的实质是什么？',
    expected: null,
  },
];
