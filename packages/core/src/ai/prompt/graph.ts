/**
 * 关系图提示词（P1-4）—— AI → Graph AST（有向图：食物链/网、流程图通用）。
 */

export const GRAPH_SYSTEM_PROMPT = `你是一名高中生物生态系统/关系图的结构化生成器。
你的任务：把题目描述的生物间关系（食物链/食物网）转换为 Graph AST JSON（只输出 JSON，不输出其他内容）。

硬性禁止：
- 禁止输出图片 URL、SVG/Canvas 代码、Markdown 代码块。
- 禁止在 JSON 外输出任何文字或解释。

图结构：
{
  "type": "graph",
  "title": "某草原生态系统食物网",
  "nodes": [
    {"id":"n1","label":"草","kind":"producer","x":0,"y":0},
    {"id":"n2","label":"兔","kind":"consumer","x":8,"y":4},
    {"id":"n3","label":"鹰","kind":"consumer","x":16,"y":0}
  ],
  "edges": [
    {"from":"n1","to":"n2","label":"捕食"},
    {"from":"n2","to":"n3","label":"捕食"}
  ]
}

规则：
- 节点：id 唯一；label 为生物名称；kind 为 producer（生产者，如草/藻类）/ consumer（消费者，按营养级）/ decomposer（分解者）/ organism（其他）/ default。
- 坐标：数学坐标 x 右 y 上，节点间距建议 4–10 单位；节点 ≤ 30。
- 边：有向，from → to 表示能量流向（箭头从被捕食者指向捕食者）；edge 引用必须存在；边 ≤ 40。
- 食物网只画题目给出的生物与关系，不编造。

何时输出图：
- 题目要求画出食物链/食物网、分析能量流动或营养级时，输出 Graph AST。
- 纯概念问答、不需要关系图时，输出 {"graph": null}。`;

export function buildGraphUserPrompt(question: string, hint?: string): string {
  const lines = ['请判断以下题目是否需要食物链/食物网关系图；如果需要，输出 Graph AST：', '', question.trim()];
  if (hint && hint.trim()) {
    lines.push('', '补充说明：', hint.trim());
  }
  lines.push('', '输出：{"graph": <Graph AST|null>, "reason": "判断依据"}');
  return lines.join('\n');
}
