import type { CellBlock } from '../structured/schemas';

export interface CellEvalCase {
  id: string;
  question: string;
  expected: CellBlock | null;
}

export const cellSamples: CellEvalCase[] = [
  {
    id: 'cell-01-plant',
    question: '画出高等植物细胞的模式图，并标注细胞壁、细胞膜、细胞核、叶绿体、线粒体、液泡、核糖体、内质网和高尔基体。',
    expected: {
      type: 'cell',
      title: '植物细胞模式图',
      cellType: 'plant',
      organelles: [
        { id: 'c1', type: 'cellWall', x: 0, y: 0, label: '细胞壁' },
        { id: 'c2', type: 'cellMembrane', x: 0, y: 0, label: '细胞膜' },
        { id: 'c3', type: 'cytoplasm', x: 0, y: 0, label: '细胞质' },
        { id: 'c4', type: 'nucleus', x: 0, y: 3, label: '细胞核' },
        { id: 'c5', type: 'chloroplast', x: -6, y: -3, label: '叶绿体' },
        { id: 'c6', type: 'mitochondria', x: 6, y: -3, label: '线粒体' },
        { id: 'c7', type: 'vacuole', x: 4, y: 5, label: '液泡' },
        { id: 'c8', type: 'ribosome', x: -4, y: 2, label: '核糖体' },
        { id: 'c9', type: 'er', x: -3, y: 6, label: '内质网' },
        { id: 'c10', type: 'golgi', x: 6, y: 6, label: '高尔基体' },
      ],
      connections: [{ from: 'c5', to: 'c6', kind: 'energy', label: '有机物/能量' }],
    },
  },
  {
    id: 'cell-02-animal',
    question: '画出高等动物细胞的模式图，标注细胞膜、细胞核、线粒体、内质网、高尔基体、核糖体、溶酶体和中心体。',
    expected: {
      type: 'cell',
      title: '动物细胞模式图',
      cellType: 'animal',
      organelles: [
        { id: 'c1', type: 'cellMembrane', x: 0, y: 0, label: '细胞膜' },
        { id: 'c2', type: 'cytoplasm', x: 0, y: 0, label: '细胞质' },
        { id: 'c3', type: 'nucleus', x: 0, y: 3, label: '细胞核' },
        { id: 'c4', type: 'mitochondria', x: 6, y: -3, label: '线粒体' },
        { id: 'c5', type: 'ribosome', x: -4, y: 2, label: '核糖体' },
        { id: 'c6', type: 'er', x: -3, y: 6, label: '内质网' },
        { id: 'c7', type: 'golgi', x: 6, y: 6, label: '高尔基体' },
        { id: 'c8', type: 'lysosome', x: 3, y: 1, label: '溶酶体' },
        { id: 'c9', type: 'centrosome', x: -6, y: -3, label: '中心体' },
        { id: 'c10', type: 'vacuole', x: 5, y: 4, label: '液泡' },
      ],
      connections: [
        { from: 'c5', to: 'c6', kind: 'synthesis', label: '蛋白质合成' },
        { from: 'c6', to: 'c7', kind: 'flow', label: '分泌' },
      ],
    },
  },
  {
    id: 'cell-03-prokaryotic',
    question: '画出细菌（原核生物）细胞的结构模式图，标注荚膜、细胞壁、细胞膜、拟核、质粒和核糖体。',
    expected: {
      type: 'cell',
      title: '细菌细胞模式图',
      cellType: 'prokaryotic',
      organelles: [
        { id: 'c1', type: 'capsule', x: 0, y: 0, label: '荚膜' },
        { id: 'c2', type: 'cellWall', x: 0, y: 0, label: '细胞壁' },
        { id: 'c3', type: 'cellMembrane', x: 0, y: 0, label: '细胞膜' },
        { id: 'c4', type: 'cytoplasm', x: 0, y: 0, label: '细胞质' },
        { id: 'c5', type: 'nucleoid', x: 0, y: 3, label: '拟核', content: 'DNA' },
        { id: 'c6', type: 'plasmid', x: 5, y: 1, label: '质粒' },
        { id: 'c7', type: 'ribosome', x: -5, y: 2, label: '核糖体' },
        { id: 'c8', type: 'flagellum', x: 8, y: 0, label: '鞭毛' },
      ],
    },
  },
  {
    id: 'cell-04-transport',
    question: '葡萄糖借助载体蛋白以协助扩散方式进入红细胞，请画出跨膜运输示意图并标出方向。',
    expected: {
      type: 'cell',
      title: '协助扩散跨膜运输示意',
      cellType: 'animal',
      organelles: [
        { id: 'c1', type: 'cellMembrane', x: 0, y: 0, label: '细胞膜' },
        { id: 'c2', type: 'cytoplasm', x: 0, y: 0, label: '细胞质' },
        { id: 'c3', type: 'nucleus', x: 0, y: 4, label: '细胞核' },
      ],
      transport: [
        { id: 't1', substance: '葡萄糖', kind: 'facilitated', direction: 'in', label: '协助扩散' },
      ],
    },
  },
  {
    id: 'cell-05-no-diagram',
    question: '细胞呼吸的实质是什么？',
    expected: null,
  },
];
