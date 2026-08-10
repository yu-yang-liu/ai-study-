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
  const subjects = '\u8bed\u6587|\u6570\u5b66|\u82f1\u8bed|\u7269\u7406|\u5316\u5b66|\u751f\u7269|\u653f\u6cbb|\u5386\u53f2|\u5730\u7406';
  const qTypes = '\u9009\u62e9\u9898|\u586b\u7a7a\u9898|\u89e3\u7b54\u9898|\u8bc1\u660e\u9898|\u8ba1\u7b97\u9898|\u5176\u4ed6';

  const FORMATS: Record<string, string> = {
    ocr: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "text": "\u8bc6\u522b\u6587\u672c",
  "blocks": [{"type": "text"|"formula"|"image", "content": "...", "confidence": 0.95}]
}`,
    analyze: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "subject": "${subjects}",
  "questionType": "${qTypes}",
  "knowledgePoints": ["\u77e5\u8bc6\u70b91", "\u77e5\u8bc6\u70b92"],
  "difficulty": 1-10,
  "answerBlocks": [{"type": "text", "content": "\u53c2\u8003\u7b54\u6848\u6587\u5b57"}, {"type": "formula", "latex": "x^2+1"}],
  "analysisBlocks": [{"type": "text", "content": "\u89e3\u6790\u6b65\u9aa4"}, {"type": "formula", "latex": "\\frac{1}{2}"}],
  "examPointsBlocks": [{"type": "text", "content": "\u8003\u70b9\u8bf4\u660e"}]
}
\u6ce8\uff1aanswer/analysis/examPoints \u5b57\u7b26\u4e32\u5b57\u6bb5\u7531\u540e\u7aef\u6d3e\u751f\uff0c\u6a21\u578b\u65e0\u9700\u8f93\u51fa\uff1b\u8bf7\u8f93\u51fa *Blocks \u6570\u7ec4\u3002\u6587\u5b57\u7528 {type:"text",content}\uff0c\u516c\u5f0f\u7528 {type:"formula",latex}\uff08\u7eaf LaTeX\uff0c\u4e0d\u8981 $ \u5305\u88f9\uff09\uff0c\u8868\u683c\u7528 {type:"table",headers,rows}\uff0c\u89e3\u9898\u6b65\u9aa4\u7528 {type:"steps",title,steps}\uff0c\u56fe\u793a\u5360\u4f4d\u7528 {type:"visual",kind:"placeholder"}\u3002${GEOMETRY_BLOCK_INSTRUCTION}`,
    analyzeImg: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "subject": "${subjects}",
  "questionType": "${qTypes}",
  "knowledgePoints": ["\u77e5\u8bc6\u70b91"],
  "difficulty": 1-10,
  "answerBlocks": [{"type": "text", "content": "\u53c2\u8003\u7b54\u6848"}],
  "analysisBlocks": [{"type": "text", "content": "\u89e3\u6790"}, {"type": "formula", "latex": "\\frac{1}{2}"}]
}
\u6ce8\uff1a\u8bf7\u8f93\u51fa *Blocks \u6570\u7ec4\uff0c\u6587\u5b57\u7528 {type:"text",content}\uff0c\u516c\u5f0f\u7528 {type:"formula",latex}\uff08\u7eaf LaTeX\uff0c\u4e0d\u8981 $ \u5305\u88f9\uff09\uff0c\u8868\u683c\u7528 {type:"table",headers,rows}\uff0c\u89e3\u9898\u6b65\u9aa4\u7528 {type:"steps",title,steps}\u3002\u5b57\u7b26\u4e32\u5b57\u6bb5\u7531\u540e\u7aef\u6d3e\u751f\u3002${GEOMETRY_BLOCK_INSTRUCTION}`,
    gradeMath: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "score": 85,
  "maxScore": 100,
  "isCorrect": true|false,
  "steps": [{"stepNumber": 1, "isCorrect": true, "feedbackBlocks": [{"type": "text", "content": "\u6b65\u9aa4\u8bc4\u4ef7"}, {"type": "formula", "latex": "x^2"}]}],
  "summaryBlocks": [{"type": "text", "content": "\u603b\u4f53\u8bc4\u4ef7"}]
}
\u6ce8\uff1a\u8bf7\u8f93\u51fa feedbackBlocks/summaryBlocks \u6570\u7ec4\uff0c\u6587\u5b57\u7528 {type:"text",content}\uff0c\u516c\u5f0f\u7528 {type:"formula",latex}\uff08\u7eaf LaTeX\uff0c\u4e0d\u8981 $ \u5305\u88f9\uff09\uff0c\u8868\u683c\u7528 {type:"table",headers,rows}\uff0c\u89e3\u9898\u6b65\u9aa4\u7528 {type:"steps",title,steps}\u3002\u5b57\u7b26\u4e32\u5b57\u6bb5\u7531\u540e\u7aef\u6d3e\u751f\u3002${GEOMETRY_BLOCK_INSTRUCTION}`,
    gradeEssay: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "score": 45,
  "maxScore": 60,
  "dimensions": {"\u5185\u5bb9": 20, "\u8868\u8fbe": 15, "\u7ed3\u6784": 10},
  "strengths": ["\u4f18\u70b9"],
  "weaknesses": ["\u4e0d\u8db3"],
  "summary": "\u603b\u4f53\u8bc4\u4ef7"
}`,
    plan: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "title": "\u8ba1\u5212\u6807\u9898",
  "description": "\u8ba1\u5212\u8bf4\u660e",
  "tasks": [{"title": "\u4efb\u52a1", "subject": "\u5b66\u79d1", "knowledgePoints": ["\u77e5\u8bc6\u70b9"], "estimatedMinutes": 30, "priority": "\u9ad8|\u4e2d|\u4f4e", "reason": "\u539f\u56e0"}]
}`,
    chat: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "reply": "\u56de\u590d\u6587\u672c",
  "replyBlocks": [{"type": "text", "content": "\u56de\u590d\u6587\u672c"}, {"type": "formula", "latex": "x^2"}]
}
\u6ce8\uff1a\u56de\u590d\u542b\u516c\u5f0f/\u8868\u683c/\u6b65\u9aa4\u65f6\uff0creply \u4e0e replyBlocks \u90fd\u8f93\u51fa\uff1b\u7eaf\u6587\u5b57\u65f6\u53ef\u7701\u7565 replyBlocks\u3002`,
    chatAgent: `\u8bf7\u8f93\u51fa JSON\uff1a
{
  "reply": "\u76f4\u63a5\u56de\u590d\u5b66\u751f\u7684\u6587\u672c\uff08\u65e0\u9700\u5de5\u5177\u65f6\u586b\u5199\uff09",
  "replyBlocks": [{"type": "text", "content": "\u56de\u590d\u6587\u672c"}, {"type": "formula", "latex": "x^2"}],
  "tool": {
    "name": "generate_plan|analyze_question|grade_submission|summarize_wrong_questions",
    "args": {}
  }
}
\u89c4\u5219\uff1a\u82e5\u53ef\u76f4\u63a5\u56de\u7b54\u5219\u586b reply\uff08\u542b\u516c\u5f0f/\u8868\u683c/\u6b65\u9aa4\u65f6\u540c\u65f6\u586b replyBlocks\uff09\uff1b\u82e5\u9700\u6267\u884c\u5de5\u5177\u5219\u586b tool\u3002\u4e0d\u8981\u540c\u65f6\u586b\u5199\u65e0\u6548\u7684 tool\u3002`,
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
  };

  return FORMATS[task] ?? '\u8bf7\u8f93\u51fa\u7b26\u5408\u8981\u6c42\u7684 JSON \u683c\u5f0f';
}
