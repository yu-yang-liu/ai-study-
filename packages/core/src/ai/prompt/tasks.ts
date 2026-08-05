import type { TaskName } from '../gateway/types';
import { CHAT_AGENT_TASK_INSTRUCTION } from './chatAgent';

const TASK_INSTRUCTIONS: Record<TaskName, string> = {
  ocr: `请识别图片中的所有文字、公式和图表。对于公式，使用 LaTeX 格式输出。`,
  analyze: `请分析以下题目：
1. 判断所属学科、题型
2. 列出涉及的知识点
3. 评估难度（1-10）
4. 给出答案和分析`,
  analyzeImg: `请分析图片中的题目：
1. 判断所属学科、题型
2. 列出涉及的知识点
3. 评估难度（1-10）
4. 给出答案和分析`,
  gradeMath: `请批改以下数学解答：
1. 给出总分
2. 逐步骤判断正误并给出反馈
3. 总结评价`,
  gradeEssay: `请批改以下作文：
1. 给出总分和各维度得分
2. 列出优点
3. 列出不足
4. 总结评价`,
  plan: `请根据学生的掌握情况，制定个性化学习计划：
1. 明确计划标题和描述
2. 列出具体任务，每项包含学科、知识点、预估时间、优先级、原因`,
  chat: `\u8bf7\u4ee5\u5b66\u79d1\u6559\u5e08\u7684\u8eab\u4efd\u56de\u7b54\u5b66\u751f\u95ee\u9898\u3002`,
  chatAgent: CHAT_AGENT_TASK_INSTRUCTION,
};

export function getTaskInstruction(task: TaskName): string {
  return TASK_INSTRUCTIONS[task] ?? '请根据以下信息作答。';
}
