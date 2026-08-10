import type { ChartBlock } from '../structured/schemas';

/** chart task 人工标注样本（首版 8 例，含 1 个负例）。 */
export interface ChartEvalCase {
  id: string;
  question: string;
  expected: ChartBlock | null;
}

export const chartSamples: ChartEvalCase[] = [
  {
    id: 'chart-01-bar-scores',
    question: '某班 40 名同学数学成绩等级分布为：A 等 12 人、B 等 18 人、C 等 7 人、D 等 3 人，画出柱状图。',
    expected: {
      type: 'chart',
      kind: 'bar',
      categories: ['A', 'B', 'C', 'D'],
      series: [{ name: '人数', values: [12, 18, 7, 3] }],
      title: '数学成绩等级分布',
      xLabel: '等级',
      yLabel: '人数',
    },
  },
  {
    id: 'chart-02-line-temperature',
    question: '某地一周最高气温（℃）：周一 18、周二 20、周三 22、周四 19、周五 24、周六 26、周日 25，画出折线图。',
    expected: {
      type: 'chart',
      kind: 'line',
      categories: ['周一', '周二', '周三', '周四', '周五', '周六', '周日'],
      series: [{ name: '最高气温', values: [18, 20, 22, 19, 24, 26, 25] }],
      title: '一周最高气温变化',
      yLabel: '气温（℃）',
    },
  },
  {
    id: 'chart-03-scatter-height-weight',
    question: '10 名学生的身高（cm）与体重（kg）数据如下：(165,52)、(170,60)、(172,63)、(168,55)、(175,68)、(180,75)、(162,48)、(178,70)、(169,58)、(173,65)，画出散点图。',
    expected: {
      type: 'chart',
      kind: 'scatter',
      points: [[165, 52], [170, 60], [172, 63], [168, 55], [175, 68], [180, 75], [162, 48], [178, 70], [169, 58], [173, 65]],
      title: '身高与体重散点图',
      xLabel: '身高（cm）',
      yLabel: '体重（kg）',
    },
  },
  {
    id: 'chart-04-histogram-frequency',
    question: '50 名学生数学成绩分组频数：[60,70) 8 人、[70,80) 15 人、[80,90) 18 人、[90,100] 9 人，画出频率分布直方图。',
    expected: {
      type: 'chart',
      kind: 'histogram',
      bins: [
        { range: [60, 70], count: 8 },
        { range: [70, 80], count: 15 },
        { range: [80, 90], count: 18 },
        { range: [90, 100], count: 9 },
      ],
      title: '数学成绩频率分布直方图',
      xLabel: '成绩',
      yLabel: '频数',
    },
  },
  {
    id: 'chart-05-pie-budget',
    question: '某家庭月支出占比：食品 40%、住房 25%、交通 15%、教育 12%、其他 8%，画出饼图。',
    expected: {
      type: 'chart',
      kind: 'pie',
      slices: [
        { label: '食品', value: 40 },
        { label: '住房', value: 25 },
        { label: '交通', value: 15 },
        { label: '教育', value: 12 },
        { label: '其他', value: 8 },
      ],
      title: '家庭月支出占比',
    },
  },
  {
    id: 'chart-06-line-two-series',
    question: '甲乙两地 1–4 月平均气温（℃）：甲 5、8、12、18；乙 8、10、14、20，画出两条折线对比。',
    expected: {
      type: 'chart',
      kind: 'line',
      categories: ['1月', '2月', '3月', '4月'],
      series: [
        { name: '甲', values: [5, 8, 12, 18] },
        { name: '乙', values: [8, 10, 14, 20] },
      ],
      title: '甲乙两地月均温对比',
    },
  },
  {
    id: 'chart-07-bar-double-series',
    question: '一班、二班各科平均分：数学 82/78、语文 85/88、英语 80/84，用柱状图对比。',
    expected: {
      type: 'chart',
      kind: 'bar',
      categories: ['数学', '语文', '英语'],
      series: [
        { name: '一班', values: [82, 85, 80] },
        { name: '二班', values: [78, 88, 84] },
      ],
      title: '两班各科平均分对比',
    },
  },
  {
    id: 'chart-08-no-chart',
    question: '解方程 3x + 5 = 20。',
    expected: null,
  },
];
