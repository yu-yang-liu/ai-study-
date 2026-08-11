import type { TaskName } from '../gateway/types';
import { CHAT_AGENT_TASK_INSTRUCTION } from './chatAgent';
import { GEOMETRY_SYSTEM_PROMPT } from './geometry';
import { CHART_SYSTEM_PROMPT } from './chart';
import { CIRCUIT_SYSTEM_PROMPT } from './circuit';
import { PEDIGREE_SYSTEM_PROMPT } from './pedigree';
import { GRAPH_SYSTEM_PROMPT } from './graph';

const BLOCK_INSTRUCTION = `
【分块输出】对于含数学公式的字段，请输出 blocks 数组而非纯字符串：
- 普通文字用 { "type": "text", "content": "..." }
- 数学公式用 { "type": "formula", "latex": "..." }（latex 为纯 LaTeX，不要用 $ 包裹）
- 表格用 { "type": "table", "headers": ["列1","列2"], "rows": [["值1","值2"]] }
- 解题步骤用 { "type": "steps", "title": "解法", "steps": [{"title": "第一步", "blocks": [...]}] }
- 示意图占位用 { "type": "visual", "kind": "placeholder" }
公式与文字分别成块，不要把公式混进 text。无公式时可只用 text 块。`;

const TASK_INSTRUCTIONS: Record<TaskName, string> = {
  ocr: `请识别图片中的所有文字、公式和图表。对于公式，使用 LaTeX 格式输出。`,
  analyze: `请分析以下题目：
1. 判断所属学科、题型
2. 列出涉及的知识点
3. 评估难度（1-10）
4. 给出答案和分析${BLOCK_INSTRUCTION}`,
  analyzeImg: `请分析图片中的题目：
1. 判断所属学科、题型
2. 列出涉及的知识点
3. 评估难度（1-10）
4. 给出答案和分析${BLOCK_INSTRUCTION}`,
  gradeMath: `请批改以下数学解答：
1. 给出总分
2. 逐步骤判断正误并给出反馈
3. 总结评价${BLOCK_INSTRUCTION}`,
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
  geometry: GEOMETRY_SYSTEM_PROMPT,
  chart: CHART_SYSTEM_PROMPT,
  circuit: CIRCUIT_SYSTEM_PROMPT,
  pedigree: PEDIGREE_SYSTEM_PROMPT,
  graph: GRAPH_SYSTEM_PROMPT,
};

export function getTaskInstruction(task: TaskName): string {
  return TASK_INSTRUCTIONS[task] ?? '请根据以下信息作答。';
}
