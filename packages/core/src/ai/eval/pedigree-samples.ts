import type { PedigreeBlock } from '../structured/schemas';

export interface PedigreeEvalCase {
  id: string;
  question: string;
  expected: PedigreeBlock | null;
}

export const pedigreeSamples: PedigreeEvalCase[] = [
  {
    id: 'pedigree-01-autosomal-recessive',
    question: '某家族中，正常夫妇 I1（男）、I2（女）生下患病儿子 II1 和正常女儿 II2；II2 与正常男性 II3 结婚生下一个患病女儿 III1。画出该遗传病系谱图。',
    expected: {
      type: 'pedigree',
      title: '某遗传病系谱图',
      generations: [
        {
          label: 'I',
          individuals: [
            { id: 'I1', gender: 'male', affected: false },
            { id: 'I2', gender: 'female', affected: false },
          ],
        },
        {
          label: 'II',
          individuals: [
            { id: 'II1', gender: 'male', affected: true },
            { id: 'II2', gender: 'female', affected: false, carrier: true },
            { id: 'II3', gender: 'male', affected: false },
          ],
        },
        {
          label: 'III',
          individuals: [{ id: 'III1', gender: 'female', affected: true, proband: true }],
        },
      ],
      marriages: [
        { spouses: ['I1', 'I2'], children: ['II1', 'II2'] },
        { spouses: ['II2', 'II3'], children: ['III1'] },
      ],
    },
  },
  {
    id: 'pedigree-02-x-linked',
    question: '患病父亲 I1 与正常母亲 I2 生有正常儿子 II1 和患病女儿 II2（先证者），画出系谱图。',
    expected: {
      type: 'pedigree',
      generations: [
        {
          label: 'I',
          individuals: [
            { id: 'I1', gender: 'male', affected: true },
            { id: 'I2', gender: 'female', affected: false },
          ],
        },
        {
          label: 'II',
          individuals: [
            { id: 'II1', gender: 'male', affected: false },
            { id: 'II2', gender: 'female', affected: true, proband: true },
          ],
        },
      ],
      marriages: [{ spouses: ['I1', 'I2'], children: ['II1', 'II2'] }],
    },
  },
  {
    id: 'pedigree-03-three-generations-carrier',
    question: '外祖父 I1 患病，外祖母 I2 正常；母亲 II1 为携带者，父亲 II2 正常；儿子 III1 患病、女儿 III2 正常，画出三代系谱图。',
    expected: {
      type: 'pedigree',
      generations: [
        {
          label: 'I',
          individuals: [
            { id: 'I1', gender: 'male', affected: true },
            { id: 'I2', gender: 'female', affected: false },
          ],
        },
        {
          label: 'II',
          individuals: [
            { id: 'II1', gender: 'female', affected: false, carrier: true },
            { id: 'II2', gender: 'male', affected: false },
          ],
        },
        {
          label: 'III',
          individuals: [
            { id: 'III1', gender: 'male', affected: true },
            { id: 'III2', gender: 'female', affected: false },
          ],
        },
      ],
      marriages: [
        { spouses: ['I1', 'I2'], children: ['II1'] },
        { spouses: ['II1', 'II2'], children: ['III1', 'III2'] },
      ],
    },
  },
  {
    id: 'pedigree-04-deceased',
    question: '已故的患病祖父 I1 与正常祖母 I2 生有一子 II1（正常），II1 与正常女性 II2 结婚生有一女 III1（患病），画出系谱图。',
    expected: {
      type: 'pedigree',
      generations: [
        {
          label: 'I',
          individuals: [
            { id: 'I1', gender: 'male', affected: true, deceased: true },
            { id: 'I2', gender: 'female', affected: false },
          ],
        },
        {
          label: 'II',
          individuals: [
            { id: 'II1', gender: 'male', affected: false },
            { id: 'II2', gender: 'female', affected: false },
          ],
        },
        {
          label: 'III',
          individuals: [{ id: 'III1', gender: 'female', affected: true, proband: true }],
        },
      ],
      marriages: [
        { spouses: ['I1', 'I2'], children: ['II1'] },
        { spouses: ['II1', 'II2'], children: ['III1'] },
      ],
    },
  },
  {
    id: 'pedigree-05-no-pedigree',
    question: '伴性遗传与常染色体遗传的区别是什么？',
    expected: null,
  },
];
