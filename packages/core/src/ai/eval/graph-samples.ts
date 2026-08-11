import type { GraphBlock } from '../structured/schemas';

export interface GraphEvalCase {
  id: string;
  question: string;
  expected: GraphBlock | null;
}

export const graphSamples: GraphEvalCase[] = [
  {
    id: 'graph-01-food-chain',
    question: '画出食物链：草 → 兔 → 鹰。',
    expected: {
      type: 'graph',
      title: '食物链',
      nodes: [
        { id: 'n1', label: '草', kind: 'producer', x: 0, y: 0 },
        { id: 'n2', label: '兔', kind: 'consumer', x: 8, y: 0 },
        { id: 'n3', label: '鹰', kind: 'consumer', x: 16, y: 0 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
      ],
    },
  },
  {
    id: 'graph-02-food-web',
    question: '某草原生态系统存在：草、鼠、兔、蛇、鹰，鼠和兔吃草，蛇吃鼠，鹰吃兔和蛇，画出食物网。',
    expected: {
      type: 'graph',
      title: '草原食物网',
      nodes: [
        { id: 'n1', label: '草', kind: 'producer', x: 0, y: 0 },
        { id: 'n2', label: '鼠', kind: 'consumer', x: 8, y: 4 },
        { id: 'n3', label: '兔', kind: 'consumer', x: 8, y: -4 },
        { id: 'n4', label: '蛇', kind: 'consumer', x: 16, y: 4 },
        { id: 'n5', label: '鹰', kind: 'consumer', x: 16, y: -4 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n1', to: 'n3' },
        { from: 'n2', to: 'n4' },
        { from: 'n3', to: 'n5' },
        { from: 'n4', to: 'n5' },
      ],
    },
  },
  {
    id: 'graph-03-energy-flow',
    question: '画出生态系统的能量流动示意图：生产者 → 初级消费者 → 次级消费者，分解者接收三者遗体残骸。',
    expected: {
      type: 'graph',
      title: '能量流动示意图',
      nodes: [
        { id: 'n1', label: '生产者', kind: 'producer', x: 0, y: 0 },
        { id: 'n2', label: '初级消费者', kind: 'consumer', x: 8, y: 0 },
        { id: 'n3', label: '次级消费者', kind: 'consumer', x: 16, y: 0 },
        { id: 'n4', label: '分解者', kind: 'decomposer', x: 8, y: 8 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n2', to: 'n3' },
        { from: 'n1', to: 'n4', style: 'dashed' },
        { from: 'n2', to: 'n4', style: 'dashed' },
        { from: 'n3', to: 'n4', style: 'dashed' },
      ],
    },
  },
  {
    id: 'graph-04-pond-food-web',
    question: '池塘食物网：藻类被水蚤和小鱼吃，水蚤被小鱼吃，小鱼被大鱼吃，画出食物网。',
    expected: {
      type: 'graph',
      title: '池塘食物网',
      nodes: [
        { id: 'n1', label: '藻类', kind: 'producer', x: 0, y: 0 },
        { id: 'n2', label: '水蚤', kind: 'consumer', x: 8, y: 4 },
        { id: 'n3', label: '小鱼', kind: 'consumer', x: 8, y: -4 },
        { id: 'n4', label: '大鱼', kind: 'consumer', x: 16, y: 0 },
      ],
      edges: [
        { from: 'n1', to: 'n2' },
        { from: 'n1', to: 'n3' },
        { from: 'n2', to: 'n3' },
        { from: 'n3', to: 'n4' },
      ],
    },
  },
  {
    id: 'graph-05-no-graph',
    question: '种群密度调查的常用方法有哪些？',
    expected: null,
  },
];
