# Science AST V3：AI Learning Intelligence 冻结版规划

> 状态：范围与协议冻结（2026-08-12）
>
> V3 对应设计文件 Phase 3，不是 Visual AST 的图元版本号。V1/V2 负责
> “内容结构化 + iOS 渲染”，V3 负责让系统基于这些结构化内容理解学习过程、
> 更新学习状态，并给出可解释的下一步建议。

## 0. 冻结声明

本文件从 2026-08-12 起作为 Science AST V3 的基线。冻结内容包括：产品边界、四层架构、核心数据协议、首批学科范围、审核安全边界和首个可开工批次。后续实现可以在不破坏这些约束的前提下推进；任何协议字段、状态语义、首批范围或权限边界的变化，都必须先更新本节并记录版本变更。

本次冻结不代表 V3 已实现，也不阻塞 V1/V2 的现有上线和尾项；V3 仍属于长期建设项目。

### 0.1 已冻结决策

- 学段固定为高中（`phase = high`），首批学科固定为数学、物理、化学、生物。
- V3 只负责学习智能：知识节点、知识关系、证据、学习状态、推荐和 iOS 局部呈现；不扩展为新的图形渲染协议。
- 模型只能产生 `candidate`，人工审核后才允许进入 `active`；任何模型失败都不得污染 active 图谱。
- 每个节点和关系必须能够追溯到题目、分析、批改、对话或教材证据；用户私有学习事件与公共知识骨架分离存储。
- 首批审核入口采用内部 CLI/管理工作流；普通用户不直接修改 active 图谱。
- 推荐默认优先级固定为：到期复习 → 掌握度低且证据充分 → 影响当前目标的前置节点 → 用户目标与可用时间匹配的计划。
- 图像识别、截图批评和视觉模型升级不属于 V3-P0 的前置条件；视觉输入只能作为可追溯证据来源之一。

## 1. V3 的边界

### 1.1 目标

建立一条可追溯的学习智能闭环：

```text
题目 / 解题步骤 / 批改 / 对话
        ↓
知识点与关系抽取
        ↓
知识图谱 + 证据链
        ↓
学习者节点状态（掌握度 / 不确定性 / 趋势）
        ↓
推荐下一题、复习节点或学习计划
        ↓
执行结果回写，更新状态
```

### 1.2 非目标

- 不让 AI 直接生成 UI，仍严格遵循 `AI → AST → Renderer → iOS UI`。
- 不在第一阶段做完全自治的 Knowledge Graph Agent。
- 不自动删除或覆盖人工确认过的节点、关系和学习记录。
- 不把题库 RAG、用户记忆和知识图谱混成一张表。
- 不因为 V3 启动而阻塞 V2 的分子结构、立体几何等尾项。

## 2. 当前地基

已经具备、V3 可以直接复用的能力：

- `packages/core/src/ai/learner/`：学习者画像、掌握度、遗忘衰减、SM-2。
- `learning_events`：分析、批改、练习、计划跟随、复习事件。
- `knowledge_mastery`：当前以字符串知识点为键的掌握度快照。
- `packages/core/src/ai/memory/`：对话摘要、跨会话事实、episodic memory。
- `question_bank` 与结构化 Visual AST：可作为知识点与能力证据来源。
- iOS SwiftUI / Canvas：可以复用现有 graph renderer 承载局部知识图谱。

当前缺口：

1. 知识点没有稳定的 canonical ID，字符串同义词无法可靠合并。
2. 没有 `requires / extends / confused_with / tested_with` 等关系的版本化存储。
3. 学习状态仍按字符串聚合，无法沿先修关系传播不确定性。
4. 推荐结果没有统一的候选、解释、执行和反馈协议。
5. 没有人工审核队列，无法安全地吸收模型新发现的节点和关系。

## 3. V3 总体架构

### 3.1 四层

1. **知识协议层**：节点、关系、证据、版本和审核状态。
2. **抽取与审核层**：从结构化题目/解题/批改中提出候选变更。
3. **学习状态层**：将事件映射到图谱节点，计算掌握度、趋势和不确定性。
4. **决策与呈现层**：生成推荐/计划，iOS 展示局部图谱和推荐理由。

### 3.2 核心原则

- **人工骨架优先**：先导入人工确认的高中学科骨架，再允许 AI 补充。
- **证据优先**：每个节点和关系都必须能回指题目、批改或教材证据。
- **候选与生效分离**：模型只能写入 `candidate`，审核后才进入 `active`。
- **可回滚**：所有合并、拆分、关系变更都保留版本和操作者。
- **面向局部子图**：客户端默认展示与当前题目/薄弱点相关的邻域，不渲染整张图。
- **数据不足时保守**：冷启动不伪造精确掌握度，推荐允许返回“信息不足”。

## 4. 数据协议（V3-P0 冻结）

### 4.1 KnowledgeNode

```ts
type KnowledgeNode = {
  id: string;                 // 永久 canonical ID
  subject: Subject;
  phase: 'middle' | 'high';
  canonicalKey: string;      // 稳定机器键，如 high.math.derivative
  title: string;
  aliases: string[];
  parentId?: string;
  status: 'candidate' | 'active' | 'deprecated';
  version: number;
  source: 'human' | 'ai' | 'imported';
};
```

### 4.2 KnowledgeEdge

```ts
type KnowledgeEdge = {
  id: string;
  fromNodeId: string;
  toNodeId: string;
  relation:
    | 'requires'
    | 'extends'
    | 'related_to'
    | 'confused_with'
    | 'tested_with';
  confidence: number;
  status: 'candidate' | 'active' | 'rejected';
  version: number;
};
```

### 4.3 Evidence

节点或关系不能只有一个分数，必须带证据：

```ts
type KnowledgeEvidence = {
  id: string;
  targetType: 'node' | 'edge';
  targetId: string;
  sourceType: 'question' | 'analysis' | 'grade' | 'chat' | 'textbook';
  sourceId: string;
  excerpt?: string;
  extractionRunId: string;
  createdAt: string;
};
```

### 4.4 LearnerNodeState

现有 `knowledge_mastery` 保留兼容字段，同时增加 canonical 节点关联：

```ts
type LearnerNodeState = {
  userId: string;
  nodeId: string;
  mastery: number;       // 0...1
  uncertainty: number;   // 0...1
  trend: 'up' | 'flat' | 'down';
  evidenceCount: number;
  lastSeen?: string;
  nextReviewAt?: string;
};
```

## 5. 分阶段路线

### V3-P0：协议、骨架与数据治理

目标：先把“知识是什么、谁能修改、如何追溯”定死。

- 新建 `packages/core/src/ai/knowledge/` 类型、schema、canonical key 工具。
- 新增 `knowledge_nodes`、`knowledge_edges`、`knowledge_evidence`、
  `knowledge_revisions`、`knowledge_extraction_runs`。
- 为现有 `knowledge_mastery` 增加 `node_id` 的兼容迁移策略。
- 导入一小批人工骨架：数学、物理、化学、生物各一个章节。
- 建立审核状态机：`candidate → approved/rejected → active`。

验收：

- 迁移可重复执行，旧的字符串知识点不丢失。
- 任一 active 节点/关系可查询完整证据和版本历史。
- 无审核权限的请求不能直接写 active 数据。

### V3-P1：Knowledge Extraction Agent（只读候选）

目标：从已有结构化数据提出候选节点、关系和证据，不直接改图谱。

建议拆成四个纯职责模块：

- `extractConcepts`：题目、解题步骤、批改反馈 → 节点候选。
- `extractRelations`：先修、扩展、易混、考查关系候选。
- `extractReasoning`：从 Solution AST / 批改步骤提取方法和错误原因。
- `deduplicateCandidates`：canonical key、别名、相似候选合并建议。

所有模型输出都必须经过 Zod schema；失败只产生 `extraction_run` 错误，
不污染 active 图谱。

验收目标（首批人工金集 200 条）：

- 节点候选 precision ≥ 0.90；
- 关系候选 precision ≥ 0.85；
- 受保护节点的错误合并数为 0；
- 每个候选都带 sourceId 和 evidence。

### V3-P2：学习状态融合

目标：把分析、批改、练习、复习事件映射到图谱节点。

- 事件先做 `knowledge_point → node_id` 解析，再更新状态。
- 掌握度同时考虑正确率、题目难度、最近时间、复习质量和证据量。
- `requires` 关系只传播“需要复习”的风险，不直接伪造高置信掌握度。
- 提供时间截面回放，防止使用未来事件造成数据泄漏。

验收：

- 同一用户同一事件重放结果幂等。
- 冷启动用户返回高 uncertainty，而非虚假的精确分数。
- 遗忘衰减、SM-2 与图谱先修关系有独立单测。

### V3-P3：推荐与计划闭环

目标：推荐可执行、可解释、可反馈。

推荐候选来源按优先级：

1. 到期复习节点；
2. 掌握度低且证据充分的节点；
3. 先修节点未掌握但影响当前目标的节点；
4. 用户目标、可用时间和偏好匹配的题目/计划。

每个推荐都携带：

```ts
{
  nodeId,
  action: 'review' | 'practice' | 'learn' | 'plan',
  reasonCodes: string[],
  evidenceIds: string[],
  expectedMinutes: number,
  confidence: number
}
```

验收：

- Top-3 推荐均可解释到节点和证据；
- 推荐被用户跳过、完成、改期都会回写事件；
- 推荐生成失败不阻断聊天、批改和做题主链路；
- 离线回放中不得引用未来事件。

### V3-P4：iOS 可视化与可控 Agent

目标：把图谱和推荐变成用户能看懂、能操作的局部视图。

- 新建 `KnowledgeGraphView.swift`，只渲染当前节点的 1–2 跳邻域。
- 节点颜色表达掌握度，边样式表达关系；候选节点默认不展示给普通用户。
- 点击节点显示证据、最近练习和推荐动作。
- `runChatAgent` 只调用推荐/解释工具，不直接编辑 active 图谱。
- 审核工具仅面向管理员/维护者。

验收：

- Swift Codable 与 API schema 往返通过；
- 20–40 个节点的局部图谱在 iOS 上可读；
- 无网络、空图、非法节点均优雅降级；
- iOS CI 全绿。

## 6. 评估体系

V3 不能只看“模型回答像不像”，需要分层评估：

| 层 | 指标 |
|---|---|
| 抽取 | node/relation precision、recall、canonical 合并错误 |
| 图谱 | 证据覆盖率、孤儿边比例、审核通过率、版本可回滚 |
| 状态 | 掌握度校准、时间回放无泄漏、事件幂等 |
| 推荐 | Top-3 可解释率、完成率、跳过率、用户改期率 |
| 产品 | 下一次练习命中薄弱点的比例、计划完成率、冷启动降级成功率 |

每个阶段都必须有：

1. 纯函数单测；
2. 人工 gold set；
3. 真 key 回归（若启用模型）；
4. 数据库迁移测试；
5. iOS Codable/渲染测试（进入 P4 后）。

## 7. 首个可开工批次

V3 不直接从“自治 Agent”开始，第一批只做：

1. 冻结 4 个学科的 canonical key 约定；
2. 建立 `knowledge_nodes/edges/evidence/revisions` schema；
3. 迁移当前字符串知识点为 alias，不删除旧字段；
4. 编写 200 条人工金集和候选输出 schema；
5. 实现只读 `GET /api/knowledge/graph` 与审核 CLI/脚本；
6. 用现有 `knowledge_mastery` 做一轮离线状态回放。

首批完成前不做：

- 自动写入 active 图谱；
- 复杂多 Agent 互相调用；
- 全量教材爬取；
- 依赖视觉模型的图像知识抽取；
- 整张知识图谱 iOS 大屏。

## 8. 冻结后的执行约束

以下事项已在本次冻结中确认，后续实现不得自行扩大范围：

1. canonical 骨架先覆盖高中，不纳入初中衔接节点；
2. 第一批固定为数学、物理、化学、生物，每科先选一个章节建立人工骨架；
3. AI 候选由内部审核人通过 CLI/管理工作流审核；
4. 题库内容默认只作为内部可追溯证据，不直接向普通用户展示原文，除非已有授权和脱敏策略；
5. 推荐按 §0.1 的固定优先级生成，用户可以手动覆盖，但覆盖结果必须回写为学习事件。

若未来需要改变上述决策，必须先创建新的 V3 版本或变更记录，不得在实现代码中隐式改变。

## 9. 开源边界

适合独立开源的部分：

- Knowledge AST schema；
- canonical key / alias 合并工具；
- extraction 输出 schema；
- 图谱评分与离线回放；
- Swift `KnowledgeGraphView` 的纯渲染层。

不应默认开源的部分：

- 用户学习事件和个人画像；
- 带原题文本的私有证据；
- 生产环境 service-role 访问与审核权限。

---

**冻结结论**：V3 先做“可追溯的知识图谱基础设施 + 人工审核闭环”，再做学习状态，
最后做推荐和 iOS Agent 体验。这样不会把当前已经稳定的 V1/V2 渲染链路和 V3
尚未验证的自治能力绑在一起。

**冻结基线**：本文件中的 V3-P0 协议和 §0.1 / §8 决策是当前唯一基线；实现、评估和 iOS 展示均以此为准。
