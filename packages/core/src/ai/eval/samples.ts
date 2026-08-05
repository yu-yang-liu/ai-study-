import type { EvalCase } from './types';

export const gradeMathSamples: EvalCase[] = [
  {
    id: 'math-01-addition',
    task: 'gradeMath',
    messages: [
      {
        role: 'user',
        content: `题目：计�?25 + 37 = �?

学生作答�?
25 + 37 = 62
步骤1：个�?5+7=12，进1
步骤2：十�?2+3+1=6
步骤3：结�?62

请批改并给出分数（满�?00）。`,
      },
    ],
    expected: {
      isCorrect: true,
      score: 100,
      maxScore: 100,
    },
    tolerances: { score: 20 },
  },
  {
    id: 'math-02-wrong',
    task: 'gradeMath',
    messages: [
      {
        role: 'user',
        content: `题目：计�?(3 + 5) × 2 = �?

学生作答�?
3 + 5 × 2 = 13

请批改并给出分数（满�?00）。`,
      },
    ],
    expected: {
      isCorrect: false,
    },
    tolerances: { score: 50 },
  },
  {
    id: 'math-03-algebra',
    task: 'gradeMath',
    messages: [
      {
        role: 'user',
        content: `题目：解方程 2x + 4 = 10

学生作答�?
2x = 10 - 4 = 6
x = 3

请批改并给出分数（满�?00）。`,
      },
    ],
    expected: {
      isCorrect: true,
      score: 100,
      maxScore: 100,
    },
    tolerances: { score: 20 },
  },
];

export const gradeEssaySamples: EvalCase[] = [
  {
    id: 'essay-01-theme',
    task: 'gradeEssay',
    messages: [
      {
        role: 'user',
        content: `作文题目：我的理�?

学生作答�?
我的理想是成为一名医生。小时候，我经常看到奶奶被病痛折磨，却因为住在偏远山区而得不到及时治疗。从那时起，我立志要学医，将来回到家乡，为更多像奶奶一样的人解除病痛�?

我知道学医的道路很漫长，需要背诵海量的医学知识，还要经历无数次的临床实践。但我相信，只要心中有信念，再难的路也能走完�?

每天放学后，我都会利用课余时间阅读医学科普书籍，了解人体结构和常见疾病的防治知识。虽然这些只是最基础的内容，但对我来说，这是迈向理想的第一步�?

我相信，只要坚持不懈地努力，总有一天我会穿上白大褂，成为一名真正的好医生�?

请从内容、结构、语言三个维度批改，满�?0分。`,
      },
    ],
    expected: {
      maxScore: 60,
    },
    tolerances: { score: 20 },
  },
];

export const allSamples: EvalCase[] = [
  ...gradeMathSamples,
  ...gradeEssaySamples,
];
