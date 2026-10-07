import type { TaskName } from '../gateway/types';
import { GEOMETRY_BLOCK_INSTRUCTION } from './geometry';
import { CHART_SYSTEM_PROMPT } from './chart';
import { CIRCUIT_SYSTEM_PROMPT } from './circuit';
import { PEDIGREE_SYSTEM_PROMPT } from './pedigree';
import { GRAPH_SYSTEM_PROMPT } from './graph';

/**
 * Generates a JSON format instruction for a given task.
 * Uses a static map rather than introspecting zod internals (v4 incompatible).
 */
export function schemaToFormatInstruction(task: TaskName): string {
  const subjects =
    '语文|数学|英语|物理|化学|生物|政治|历史|地理';
  const qTypes =
    '选择题|填空题|解答题|证明题|计算题|其他';

  const FORMATS: Record<string, string> = {
    ocr: `请输出 JSON：
{
  "text": "识别文本",
  "blocks": [{"type": "text"|"formula"|"image", "content": "...", "confidence": 0.95}]
}`,
    analyze: `请输出 JSON：
{
  "subject": "${subjects}",
  "questionType": "${qTypes}",
  "knowledgePoints": ["知识点1", "知识点2"],
  "difficulty": 1-10,
  "answerBlocks": [{"type": "text", "content": "参考答案文字"}, {"type": "formula", "latex": "x^2+1"}],
  "analysisBlocks": [{"type": "text", "content": "解析步骤"}, {"type": "formula", "latex": "\\frac{1}{2}"}],
  "examPointsBlocks": [{"type": "text", "content": "考点说明"}]
}
注：answer/analysis/examPoints 字符串字段由后端派生，模型无需输出；请输出 *Blocks 数组。文字用 {type:"text",content}，公式用 {type:"formula",latex}（纯 LaTeX，不要 $ 包裹），表格用 {type:"table",headers,rows}，解题步骤用 {type:"steps",title,steps}，图示占位用 {type:"visual",kind:"placeholder"}。${GEOMETRY_BLOCK_INSTRUCTION}`,
    analyzeImg: `请输出 JSON：
{
  "subject": "${subjects}",
  "questionType": "${qTypes}",
  "knowledgePoints": ["知识点1"],
  "difficulty": 1-10,
  "answerBlocks": [{"type": "text", "content": "参考答案"}],
  "analysisBlocks": [{"type": "text", "content": "解析"}, {"type": "formula", "latex": "\\frac{1}{2}"}]
}
注：请输出 *Blocks 数组，文字用 {type:"text",content}，公式用 {type:"formula",latex}（纯 LaTeX，不要 $ 包裹），表格用 {type:"table",headers,rows}，解题步骤用 {type:"steps",title,steps}。字符串字段由后端派生。${GEOMETRY_BLOCK_INSTRUCTION}`,
    gradeMath: `请输出 JSON：
{
  "score": 85,
  "maxScore": 100,
  "isCorrect": true|false,
  "knowledgePoints": ["知识点1", "知识点2"],
  "difficulty": 1-10,
  "errorType": "审题不清|概念混淆|公式错误|计算失误|方法错误|表达不完整",
  "abilityAssessment": {"理解": "强|中|弱", "推理": "强|中|弱", "计算": "强|中|弱", "应用": "强|中|弱"},
  "steps": [{"stepNumber": 1, "isCorrect": true, "feedbackBlocks": [{"type": "text", "content": "步骤评价"}, {"type": "formula", "latex": "x^2"}]}],
  "summaryBlocks": [{"type": "text", "content": "总体评价"}]
}
注：请输出 feedbackBlocks/summaryBlocks 数组，文字用 {type:"text",content}，公式用 {type:"formula",latex}（纯 LaTeX，不要 $ 包裹），表格用 {type:"table",headers,rows}，解题步骤用 {type:"steps",title,steps}。字符串字段由后端派生。${GEOMETRY_BLOCK_INSTRUCTION}`,
    gradeEssay: `请输出 JSON：
{
  "score": 45,
  "maxScore": 60,
  "dimensions": {"内容": 20, "表达": 15, "结构": 10},
  "strengths": ["优点"],
  "weaknesses": ["不足"],
  "summary": "总体评价"
}`,
    plan: `请输出 JSON：
{
  "title": "计划标题",
  "description": "计划说明",
  "tasks": [{"title": "任务", "subject": "学科", "knowledgePoints": ["知识点"], "estimatedMinutes": 30, "priority": "高|中|低", "reason": "原因"}]
}`,
    chat: `请输出 JSON：
{
  "reply": "回复文本",
  "replyBlocks": [{"type": "text", "content": "回复文本"}, {"type": "formula", "latex": "x^2"}]
}
注：回复含公式/表格/步骤时，reply 与 replyBlocks 都输出；纯文字时可省略 replyBlocks。`,
    chatAgent: `请输出 JSON：
{
  "reply": "直接回复学生的文本（无需工具时填写）",
  "replyBlocks": [{"type": "text", "content": "回复文本"}, {"type": "formula", "latex": "x^2"}],
  "tool": {
    "name": "generate_plan|analyze_question|grade_submission|summarize_wrong_questions",
    "args": {}
  }
}
规则：若可直接回答则填 reply（含公式/表格/步骤时同时填 replyBlocks）；若需执行工具则填 tool。不要同时填写无效的 tool。`,
    geometry: `请输出 JSON：
{
  "geometry": {"type":"scene","elements":[...]} 或 null,
  "reason": "判断依据"
}
注意：geometry 必须为合法 Geometry AST（scene/coordinateSystem，元素 ≤ 20，数学坐标、角度单位度）；不需要图形时 geometry 为 null。`,
    chart: `请输出 JSON：
{
  "chart": {"type":"chart","kind":"bar","categories":["A","B"],"series":[{"name":"x","values":[3,5]}]} 或 null,
  "reason": "判断依据"
}
注意：chart 必须为合法 Chart AST（kind 五选一：bar/line/scatter/histogram/pie；字段见系统提示词）；不需要图表时 chart 为 null。`,
    circuit: `请输出 JSON：
{
  "circuit": {"type":"circuit","nodes":[{"id":"b1","type":"battery","x":0,"y":0,"value":"6V"},{"id":"l1","type":"bulb","x":10,"y":0}],"wires":[{"from":"b1","to":"l1"},{"from":"l1","to":"b1"}]} 或 null,
  "reason": "判断依据"
}
注意：circuit 必须为合法 Circuit AST（nodes/wires 见系统提示词，wire 引用必须存在）；不需要电路图时 circuit 为 null。`,
    pedigree: `请输出 JSON：
{
  "pedigree": {"type":"pedigree","generations":[{"label":"I","individuals":[{"id":"I1","gender":"male","affected":true}]}],"marriages":[{"spouses":["I1","I2"],"children":["II1"]}]} 或 null,
  "reason": "判断依据"
}
注意：pedigree 必须为合法 Pedigree AST（generations/marriages 见系统提示词，引用必须存在）；不需要系谱图时 pedigree 为 null。`,
    graph: `请输出 JSON：
{
  "graph": {"type":"graph","nodes":[{"id":"n1","label":"草","kind":"producer","x":0,"y":0},{"id":"n2","label":"兔","kind":"consumer","x":8,"y":4}],"edges":[{"from":"n1","to":"n2"}]} 或 null,
  "reason": "判断依据"
}
注意：graph 必须为合法 Graph AST（nodes/edges 见系统提示词，引用必须存在）；不需要关系图时 graph 为 null。`,
    lab: `请输出 JSON：
{
  "lab": {"type":"lab","title":"制取装置","apparatus":[{"id":"a1","type":"stand","x":0,"y":0},{"id":"a2","type":"flask","x":0,"y":8,"content":"H2O2"}],"connections":[{"from":"a1","to":"a2"}]} 或 null,
  "reason": "判断依据"
}
注意：lab 必须为合法 Lab AST（apparatus/connections 见系统提示词，connection 引用必须存在）；不需要装置图时 lab 为 null。`,
    cell: `请输出 JSON：
{
  "cell": {"type":"cell","title":"植物细胞模式图","cellType":"plant","organelles":[{"id":"c1","type":"cellWall","x":0,"y":0},{"id":"c2","type":"cellMembrane","x":0,"y":0},{"id":"c3","type":"nucleus","x":0,"y":3,"label":"细胞核"}],"connections":[{"from":"c1","to":"c3"}]} 或 null,
  "reason": "判断依据"
}
注意：cell 必须为合法 Cell AST（cellType/organelles/connections/transport 见系统提示词，connection 引用必须存在）；不需要模式图时 cell 为 null。`,
    molecular: `请输出 JSON：
{
  "molecular": {"type":"molecular","title":"乙醇结构式","atoms":[{"id":"c1","symbol":"C","x":0,"y":0},{"id":"o1","symbol":"O","x":2,"y":0}],"bonds":[{"from":"c1","to":"o1","order":1}]} 或 null,
  "reason": "判断依据"
}
注意：molecular 必须为合法 Molecular AST，bonds 只能引用 atoms 中存在的 id；不需要分子结构图时 molecular 为 null。`,
  };

  return FORMATS[task] ?? '请输出符合要求的 JSON 格式';
}
