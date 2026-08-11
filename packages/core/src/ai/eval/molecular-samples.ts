import type { MolecularBlock } from '../structured/schemas';

export interface MolecularEvalCase {
  id: string;
  question: string;
  expected: MolecularBlock | null;
}

export const molecularSamples: MolecularEvalCase[] = [
  {
    id: 'molecular-01-water',
    question: '请画出水分子的结构示意图，标出氧原子和两个氢原子。',
    expected: {
      type: 'molecular',
      title: '水分子',
      atoms: [
        { id: 'o1', symbol: 'O', x: 0, y: 0, label: 'O' },
        { id: 'h1', symbol: 'H', x: -1.4, y: 0.8, label: 'H' },
        { id: 'h2', symbol: 'H', x: 1.4, y: 0.8, label: 'H' },
      ],
      bonds: [
        { from: 'o1', to: 'h1', order: 1 },
        { from: 'o1', to: 'h2', order: 1 },
      ],
    },
  },
  {
    id: 'molecular-02-ethanol',
    question: '请画出乙醇 CH3CH2OH 的结构式，使用碳、氧、氢原子和单键。',
    expected: {
      type: 'molecular',
      title: '乙醇',
      atoms: [
        { id: 'c1', symbol: 'C', x: 0, y: 0 },
        { id: 'c2', symbol: 'C', x: 2, y: 0 },
        { id: 'o1', symbol: 'O', x: 4, y: 0 },
      ],
      bonds: [
        { from: 'c1', to: 'c2', order: 1 },
        { from: 'c2', to: 'o1', order: 1 },
      ],
    },
  },
  {
    id: 'molecular-03-benzene',
    question: '请画出苯环的结构示意图，六个碳原子组成环并交替使用单双键。',
    expected: {
      type: 'molecular',
      title: '苯',
      atoms: [
        { id: 'c1', symbol: 'C', x: 1, y: 0 },
        { id: 'c2', symbol: 'C', x: 0.5, y: 0.866 },
        { id: 'c3', symbol: 'C', x: -0.5, y: 0.866 },
        { id: 'c4', symbol: 'C', x: -1, y: 0 },
        { id: 'c5', symbol: 'C', x: -0.5, y: -0.866 },
        { id: 'c6', symbol: 'C', x: 0.5, y: -0.866 },
      ],
      bonds: [
        { from: 'c1', to: 'c2', order: 2 },
        { from: 'c2', to: 'c3', order: 1 },
        { from: 'c3', to: 'c4', order: 2 },
        { from: 'c4', to: 'c5', order: 1 },
        { from: 'c5', to: 'c6', order: 2 },
        { from: 'c6', to: 'c1', order: 1 },
      ],
    },
  },
  {
    id: 'molecular-04-no-diagram',
    question: '什么是氧化还原反应？请说明电子转移的判定方法。',
    expected: null,
  },
];
