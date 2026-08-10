# Science AST · iOS 三版本实施方案

> 状态：**V1 已完成**（iOS CI 全绿，2026-08-09）· **V2 几何核心已完成**（化学分子结构等扩展待排期）· **V3 未启动**（长期积累型，按设计不提前开发）
> 基线：2026-08-09 · 以 **Swift / iOS 为主体**，其他端（Web / Android）本期不推进
> 关联：[RENDER_AST.md](./RENDER_AST.md)、[PROJECT_REFERENCE.md](./PROJECT_REFERENCE.md)、[VISUAL_AST.md](./VISUAL_AST.md)、设计文件 §8/§9
> **命名对照**：本文 V1/V2/V3 为 Science AST 三版本体系；RENDER_AST 的 M1（公式）∈ V1、M2（几何）∈ V2；visual-ast 子项目的 v1–v5 是另一套里程碑编号，勿混用。

---

## 0. 设计文件的硬性要求（本方案严格遵循）

| # | 要求 | 落地约束 |
|---|------|---------|
| 1 | AI 不直接生成 UI | 全链路只允许 `AI → AST → Renderer → iOS UI` |
| 2 | 不使用 Markdown 作为主要协议 | 内容一律走结构化 block / AST 节点 |
| 3 | 图像不是图片 | 禁止 `AI → 图片URL → 显示`、禁止 `AI → TikZ → 图片` |
| 4 | 几何采用 Geometry AST → Swift Canvas / Shape 动态渲染 | 不引入图片资产，不依赖 WebView |
| 5 | 不提前开发复杂 Agent | Knowledge Graph Agent 属于 V3，V1/V2 不启动 |
| 6 | 分三阶段渐进迁移 | V1=Phase 1 基础层 → V2=Phase 2 可视化引擎 → V3=Phase 3 学习智能 |

---

## 1. 现状盘点（读码结论）

### 1.1 已经存在的（截至 2026-08-09 均已提交）

- 后端 `packages/core`：`blockSchema`（text/formula/image）、`analyze`/`gradeMath` 的 `*Blocks` 字段、分块输出 prompt、`blocksToPlainText` 派生 string（B 策略双字段过渡）。
- iOS：
  - `ApiContracts/ContentBlock.swift`：text/formula/image 三态解码（容错降级）。
  - `AnalyzeModels` / `GradeModels`：已携带 `answerBlocks` / `analysisBlocks` / `examPointsBlocks` / `summaryBlocks` / `feedbackBlocks`。
  - `CoreKit/FormulaView.swift`：`MathBackend` 协议 + `UnicodeMathBackend`（纯 Swift Unicode 降级）；iosMath 已接入（`kostub/iosMath from: "2.5.0"`，`defaultBackend` 在 `canImport(iosMath)` 时自动切 `IosMathBackend`，Unicode 作降级）。
  - `CoreKit/MarkdownRenderer.swift`：已有 `init(blocks:)`，text/formula/image 三个分支渲染。
  - `AnalysisResultView` / `GradeResultView`：已消费 blocks（缺省回退 string）。
  - 测试：`ContentBlockTests`、`UnicodeMathBackendTests`。

### 1.2 尚未覆盖（三版本要补齐的）

| 缺口 | 现状 |
|------|------|
| 化学分子结构（V2 末段） | 未启动（`molecular` block 规划见 [GEOMETRY_V2_EXTENSIONS.md](./GEOMETRY_V2_EXTENSIONS.md) §C） |
| 立体几何 / 圆锥曲线（V2 扩展） | 未启动（box/cylinder/cone/conic 规划见 GEOMETRY_V2_EXTENSIONS §B） |
| 动态几何 / relation 节点（V2 扩展） | 未启动 |
| Web / Android 渲染器 | 未推进（本期以 Swift/iOS 为主体） |
| V3 Knowledge Graph Agent | 未启动（长期积累型，按设计不提前开发） |

---

## 2. 三版本总览

| 版本 | 对应设计文件 | 名称 | 目标 | 核心交付 |
|------|------------|------|------|---------|
| **V1** | Phase 1 | Science AST 基础层 | 建立内容协议 | AST Schema + Validator + Swift Renderer，支持文本/表格/图片/步骤/基础视觉 |
| **V2** | Phase 2 | 学科可视化引擎 | 内容交互化 | Geometry AST + Swift Canvas/Shape；数学函数图像、物理示意、化学分子结构 |
| **V3** | Phase 3 | AI Learning Intelligence | 让系统理解学习 | Knowledge Graph Agent + 学习状态模型 + 个性化推荐 + 智能规划 |

> 每版本验收都包含：读级审查（Swift 6 / 严格并发 / Sendable / missing_docs）+ 推非 main 分支触发 [ios-ci.yml](../.github/workflows/ios-ci.yml)（macOS runner：ApiContracts/CoreKit `swift build`+`swift test` → `xcodegen generate` → `xcodebuild build`）。Windows 无本地构建，以 CI 为唯一构建验证。

---

## 3. V1 — Science AST 基础层（已完成）

### 3.0 实施记录（2026-08-09）

- [x] `blockSchema` 升级为**判别联合**：text / formula / image / table / steps / visual，覆盖四类子 AST（映射见 §2）。
- [x] 后端 Validator：严格 schema + `schemas.test.ts`（非法结构拒绝、递归 steps、visual.kind 默认值）。
- [x] `blocksToPlainText` 扩展 table / steps / visual 派生，OCR 旧格式回退保留。
- [x] Prompt：`tasks.ts` BLOCK_INSTRUCTION 与 `format.ts` 增加表格/步骤/视觉分块指令。
- [x] Chat 链路：`chatAgentOutput` / `chatOutput` 增加 `replyBlocks`（双字段过渡），`runChatAgent` + `/api/chat` 透传，iOS `ChatResponse.replyBlocks` + 气泡走 blocks。
- [x] Swift Renderer：`ContentBlock` 新增 table / steps / visual + `StepContent` / `InteractionHint`；`MarkdownRenderer(blocks:)` 三个新分支；`TableBlockView` / `StepsBlockView` / `VisualPlaceholderView` 新建。
- [x] 后端验证：core `tsc --noEmit` 通过、vitest 108 passed / 2 skipped（2 个需 `DEEPSEEK_API_KEY` 的真跑测试）；web `tsc --noEmit` 通过。
- [x] iOS 构建验证：macOS CI 全绿（PR #2/#3，2026-08-09）。
- [x] iosMath 集成：`kostub/iosMath from: "2.5.0"`；`IosMathBackend` 默认启用，`UnicodeMathBackend` 降级保留。

### 3.1 目标

把 `ContentBlock` 从"text/formula/image 三块"升级为 **Science AST 基础协议**，覆盖设计文件 Phase 1 要求的文本 / 表格 / 图片 / 步骤 / 基础视觉内容，并让 iOS 三个消费场景（题目分析、作业批改、AI 对话）全部走 AST 渲染。

### 3.2 交付物

**1) AST Schema（后端 + iOS 同步）**

```ts
// packages/core/src/ai/structured/schemas.ts
type Block =
  | { type: "text"; content: string }
  | { type: "formula"; latex: string }               // 纯 LaTeX，无 $ 定界符
  | { type: "image"; url: string; alt?: string }
  | { type: "table"; headers?: string[]; rows: string[][] }   // 新增
  | { type: "steps"; title?: string; steps: StepBlock[] }     // 新增：结构化步骤
  | { type: "visual"; kind: "placeholder" }                    // 新增：基础视觉占位（V2 替换为 geometry）
```

`StepBlock = { content: Block[]; isCorrect?: boolean; tag?: string }`。

- iOS：`ApiContracts/ContentBlock.swift` 增加 `table` / `steps` / `visual` case（解码容错与现有策略一致）。
- 受影响模型：`AnalyzeResponse`、`GradeMathResponse`、`ChatResponse`（chat 从 `reply: String` 增加 `replyBlocks: [ContentBlock]` 双字段过渡）。

**2) Validator**

- 后端：`blockSchema` 从"单对象可选项"收敛为**判别联合**（`z.discriminatedUnion("type")`），新增 `validateBlocks` 纯函数 + 单测（扩展 `blocks.test.ts`）。
- iOS：`ContentBlock` 解码容错 + 非法块降级不崩（沿用现有策略），补 `table`/`steps` 解码测试。

**3) Swift Renderer**

- `MarkdownRenderer(blocks:)` 新增三个分支：
  - `.table` → `TableBlockView`（SwiftUI Grid，表头加粗、行列自适应）；
  - `.steps` → `StepsBlockView`（编号 + 对错图标 + 内部 block 递归渲染）；
  - `.visual` → `VisualPlaceholderView`（V2 前显示占位说明，不做图片）。
- 公式渲染决策：**先以 `UnicodeMathBackend` 收口跑通全链路**；iosMath SPM fork/版本确认后作为 `MathBackend` 第二实现增量替换（接口不变，见 RENDER_AST §2.4）。
- 接入点：`AnalysisResultView`、`GradeResultView`、`ChatView`（`MessageBubble` 的助手消息改 `MarkdownRenderer(blocks: replyBlocks ?? [.text(content:)])`）。

**4) 后端全链路**

- `tasks.ts` / `format.ts`：analyze / gradeMath / chat 全量输出 blocks（表格、步骤、公式分块指令）。
- `learning/actions.ts`：`blocksToPlainText` 派生逻辑保留（string 字段供 DB/RAG 消费），新增表格/步骤的 plain-text 派生。
- 迁移策略：双字段过渡 → iOS 全量切 blocks 后移除 string 字段（RENDER_AST §2.1 兼容策略）。

### 3.3 涉及文件

| 文件 | 动作 |
|------|------|
| `packages/core/src/ai/structured/schemas.ts` | Block 判别联合 + table/steps/visual |
| `packages/core/src/ai/structured/blocks.ts` + `blocks.test.ts` | 新增派生与校验 |
| `packages/core/src/ai/prompt/tasks.ts` / `format.ts` | 表格/步骤分块指令 |
| `packages/core/src/learning/actions.ts` | chat/analyze/grade 透传 blocks |
| `packages/ios/ApiContracts/.../ContentBlock.swift` | 新增 case + 解码 |
| `packages/ios/ApiContracts/.../ChatModels.swift` | replyBlocks |
| `packages/ios/CoreKit/.../MarkdownRenderer.swift` | table/steps/visual 分支 |
| `packages/ios/CoreKit/.../Components/TableBlockView.swift` | 新建 |
| `packages/ios/CoreKit/.../Components/StepsBlockView.swift` | 新建 |
| `packages/ios/ios-gaokao/.../ChatView.swift` | 助手消息走 blocks |
| `packages/ios/ApiContracts/.../ContentBlockTests.swift` | 新 case 测试 |
| `packages/ios/CoreKit/Package.swift` | iosMath 集成（待 fork 确认） |

### 3.4 验收

- analyze / grade / chat 三条链路在 iOS 全走 blocks，表格、步骤、公式、图片四类内容渲染正确；
- `swift test`（ApiContracts + CoreKit）全绿，`xcodebuild` 通过；
- 后端 `tsc --noEmit` + `vitest` 全绿；
- 不再有「公式源码 / 无表格 / chat 纯字符串」的可见问题。

---

## 4. V2 — 学科可视化引擎（设计文件 Phase 2）

### 4.1 目标

让数学 / 物理 / 化学的图形内容**结构化 + 可交互**：Geometry AST → Swift `Canvas` / `Shape` 动态渲染。

### 4.0 实施记录（2026-08-09）

- [x] ApiContracts `GeometryAST.swift`：scene / coordinateSystem + 10 种元素（容错解码 + 往返编码）。
- [x] CoreKit `ExpressionEvaluator.swift`：安全表达式求值（+ - * / ^、初等函数，无 eval）。
- [x] CoreKit `CoordinateTransformer.swift` + `GeometryBounds`：数学坐标 → 屏幕坐标（y 翻转、等比居中、退化边界防护）。
- [x] CoreKit `GeometryCanvasView.swift`：SwiftUI `Canvas` + 每元素 drawer（point/line/vector/triangle/polygon/circle/arc/angle/functionCurve/label）+ 坐标轴/网格/刻度 + 3 个 #Preview（三角形+角、坐标系+函数曲线、力的合成）。
- [x] `ContentBlock.visual` 携带 `geometry` 数据；`MarkdownRenderer` 对 `kind == "geometry"` 渲染 `GeometryCanvasView`，否则占位。
- [x] 测试：ApiContracts `GeometryASTTests`（解码/往返/降级）、CoreKit `GeometryTests`（求值器/边界/坐标变换）。
- [x] 后端 `geometry` task + 提示词定稿 + eval 准确率（通过率 100%，见 [GEOMETRY_PROMPT_EVAL.md](./GEOMETRY_PROMPT_EVAL.md)）。
- [x] analyze/gradeMath/chat 生产链路接入 visual block：`sanitizeBlocks` 校验 geometry，非法降级为占位，整响应不崩。
- [x] **M-D 端到端**：独立 `geometry` task 后置检测 + attach（数学/物理题），`analyze-geometry-e2e.test.ts` 真 key 通过（2026-08-09）。
- [ ] 化学分子结构（图谱布局，V2 末段）。
- [x] iOS 构建验证：macOS CI 全绿（PR #2/#3 合并，2026-08-09）。

### 4.2 交付物

**1) Geometry AST（Swift 端）**

移植 [visual-ast](../packages/visual-ast/src/types.ts) v1 协议到 Swift（节点对应设计文件：PointNode / LineNode / CircleNode / PolygonNode / LabelNode / RelationNode + v1 扩展：angle / vector / functionCurve）：

```swift
// packages/ios/ApiContracts/Sources/ApiContracts/Models/GeometryAST.swift（新建）
public enum GeometryAST: Codable, Sendable {
    case scene(elements: [GeometryElement], bounds: SceneBounds?)
    case coordinateSystem(xRange: ClosedRange<Double>, yRange: ClosedRange<Double>, children: [GeometryElement])
}
```

**2) Swift Renderer**

- `CoreKit/Components/GeometryCanvasView.swift`（新建）：`Canvas` 绘制 + `CoordinateTransformer`（数学坐标 ↔ 屏幕坐标，等比缩放居中）。
- 每元素一个 drawer：`PointDrawer` / `LineDrawer` / `CircleDrawer` / `PolygonDrawer` / `AngleDrawer` / `FunctionCurveDrawer` / `VectorDrawer`。
- `functionCurve` 表达式求值：移植 `visual-ast/src/expr.ts` 的安全求值器（无 eval）。
- v1 先跑通两个 demo：**三角形 + 角标注**、**坐标系 + 函数曲线**（对齐 RENDER_AST §3.3）。

**3) 学科覆盖**

| 学科 | 内容 | 节点 |
|------|------|------|
| 数学 | 平面几何 | triangle / angle / circle / line / point / label |
| 数学 | 函数图像 | coordinateSystem + functionCurve |
| 物理 | 实验示意 / 参数变化 | scene + vector / line / 滑块驱动重绘 |
| 化学 | 分子结构 | graph 布局（V2 末段，节点 + 边） |

**4) 后端**

- `geometry` task：输入题目文本 → 输出 `{ geometry, reason }`（schemas.ts 严格判别联合，独立移植 visual-ast 协议到 core，避免 workspace 依赖）；
- 提示词权威版：`packages/core/src/ai/prompt/geometry.ts`（`GEOMETRY_SYSTEM_PROMPT` / `GEOMETRY_BLOCK_INSTRUCTION`）；
- 生产链路：analyze 文本题（数学/物理）走「独立 `geometry` task 后置检测 + attach 到 analysisBlocks」（`actions.ts` `attachGeometryVisualBlock`）；gradeMath/chat 仅保留弱信号；
- eval：`geometry-samples.ts`（11 例含负例）+ `geometry-scoring.ts`（9 维加权，eval v2 相似变换等价匹配）+ 真 key e2e（`analyze-geometry-e2e.test.ts`）。

### 4.3 涉及文件

| 文件 | 动作 |
|------|------|
| `packages/ios/ApiContracts/.../GeometryAST.swift` | 已落地 |
| `packages/ios/CoreKit/.../Components/GeometryCanvasView.swift` | 已落地 |
| `packages/ios/CoreKit/.../Geometry/CoordinateTransformer.swift` | 已落地 |
| `packages/ios/CoreKit/.../Geometry/Drawers/*.swift` | 已落地 |
| `packages/ios/CoreKit/.../Math/ExpressionEvaluator.swift` | 已落地（移植 expr.ts） |
| `packages/ios/ios-gaokao/.../AnalysisResultView.swift` | 几何 block 渲染（已接入） |
| `packages/core/src/ai/structured/schemas.ts` | visualBlock（kind geometry）+ geometryAstSchema/geometryOutputSchema |
| `packages/core/src/ai/prompt/geometry.ts` | 几何提示词权威版 |
| `packages/core/src/learning/actions.ts` | attachGeometryVisualBlock（analyze 后置检测）+ sanitizeBlocks |
| `packages/core/src/ai/eval/` | 几何 AST 准确率 cases（11 例 + 真 key e2e） |

### 4.4 验收

- 三角形+角、坐标系+函数曲线两个 demo 在 iOS 渲染正确；
- AI 输出 geometryAst 准确率达到阈值（eval 报告）；
- 交互（参数变化重绘）可用（V2 扩展项，尚未交付）；
- 全程无图片 URL / TikZ，纯 Swift Canvas / Shape。

---

## 5. V3 — AI Learning Intelligence（设计文件 Phase 3）

> **状态与节奏**：V3 **未启动**，且是**长期积累型**能力——知识图谱依赖真实题目 / 批改 / 对话数据持续积累 + 人工骨架审核闭环，不以「里程碑勾选」表达进度；设计文件明确要求"不提前开发复杂 Agent"（见 §0 第 5 条、§6）。

### 5.1 目标

让系统理解学习：Knowledge Graph Agent（设计文件 §6–7）+ 学习状态模型 + 个性化推荐 + 智能规划。

### 5.2 交付物

**1) Knowledge Graph Agent（独立开源模块）**

```
Input → Extraction Agent → Knowledge Nodes → Relation Agent → Knowledge Graph → Graph Optimizer
```

- `Concept Extraction Agent`：从题目 / 解题过程 / 教材 / 文档 / 对话提取知识点、技能、方法；
- `Relation Agent`：建立 `requires` / `extends` / `related_to` / `confused_with` / `tested_with` 关系；
- `Reasoning Analyzer Agent`：分析解题过程 → 使用方法、能力点、错误原因（对齐 Solution AST 的知识提取）；
- `Graph Manager`：去重、合并、冲突处理、版本管理；
- 路线：人工定义知识骨架 → AI 补充节点与关系 → 人工审核 → 数据反馈优化。

落点建议：`packages/core/src/ai/knowledge/`（独立目录，便于日后拆仓开源）；DB 新增 `knowledge_nodes` / `knowledge_edges` 表 + 迁移。

**2) 学习状态模型**

- 现有 `packages/core/src/ai/learner/`（SM-2、画像）深化为显式状态模型：知识掌握度由 Knowledge Graph 上的节点状态聚合。

**3) 个性化推荐 + 智能规划**

- `runChatAgent` 工具层扩展：推荐下一学习任务、基于图谱缺口生成计划；
- iOS 消费端：图谱可视化页（Geometry AST 可复用于图谱节点布局渲染）、推荐卡片。

### 5.3 涉及文件

| 文件 | 动作 |
|------|------|
| `packages/core/src/ai/knowledge/` | 新建（extraction / relation / reasoning / graph-manager） |
| `packages/core/src/db/schema.ts` + `migrations/` | knowledge_nodes / knowledge_edges |
| `packages/core/src/ai/learner/` | 学习状态模型深化 |
| `packages/core/src/ai/agent/runChatAgent.ts` | 推荐 / 图谱工具 |
| `packages/ios/ios-gaokao/.../KnowledgeGraphView.swift` | 新建（图谱可视化） |

### 5.4 验收

- 从真实题目 / 批改记录自动构建知识图谱（人工骨架 + AI 补充 + 审核闭环）；
- 图谱驱动个性化推荐与计划，iOS 可见；
- 独立模块可提取为开源仓库（MIT）。

---

## 6. 版本依赖与顺序

```
V1（Science AST 基础层）→ 内容协议与渲染全链路收口
        ↓
V2（学科可视化引擎）→ 在 V1 的 visual 节点上替换为 Geometry AST 真实渲染
        ↓
V3（AI Learning Intelligence）→ 在 V2 的内容之上构建知识理解
```

- V1 是 V2 的前提：`visual` 占位节点由 V2 的 `geometry` block 替换；
- V2 是 V3 的数据基础：知识图谱从题目 / 解题 / 教材中提取，V1/V2 的结构化内容正是提取源；
- V1/V2 均可独立交付验证；V3 不提前启动（设计文件要求"不提前开发复杂 Agent"）。

---

*文档版本：2026-08-10 · 严格对齐设计文件 Phase 1/2/3 · V1/V2 核心已完成，V3 长期积累未启动 · Swift/iOS 为主体，其他端不推进*
