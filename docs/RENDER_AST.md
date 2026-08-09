# 公式与几何渲染 — AST 渲染方案

> 状态：**公式 M1 实施完成（待 CI 验证）/ 几何 M2 待启动**
> 基线：2026-08-09 · 对应当前工作区代码状态（STEPS 1–7 已落地）
> 关联：[PROJECT_REFERENCE.md](./PROJECT_REFERENCE.md) §7 P1、[AGENT_MEMORY.md](./AGENT_MEMORY.md)

---

## 0. 背景与根因

历史项目中，前端对**数学专业符号和几何图形**显示有问题。根因诊断：

- **后端契约**（`packages/core/src/ai/prompt/tasks.ts`）：`ocr` 任务已明确"对于公式，使用 LaTeX 格式输出"。`analyze` / `gradeMath` 的 `answer` / `analysis` / `examPoints` / `feedback` / `summary` 字段为**纯字符串**，公式 LaTeX 与中文混排，**无定界符约定、无结构标记**。
- **前端渲染**（`packages/ios/CoreKit/.../MarkdownRenderer.swift`）：手写 SwiftUI markdown 渲染器（`Text` 拼接），**无 LaTeX 解析**。`\frac{...}` 等串原样显示。
- **结论**：最容易出公式的链路（解题步骤、参考答案），恰恰是定界符最没保障的链路。`Text(answer)` 连 markdown 都没过。

---

## 1. 设计原则（已与用户确认）

> 用户决策（2026-08-08）：
> - 公式：**不依赖 Markdown `$$` 定界符**。公式作为 **AST 节点**，由 `FormulaView` 渲染，`latex` 作为节点字段。
> - 几何：**不要图 URL / TikZ**。采用 **Geometry AST**，Swift `Canvas` / `Shape` 动态渲染。
> - 渲染方式：**方式一** —— iosMath 管公式排版，SwiftUI 管壳与交互；**不**用 WebView 全包。

### 为什么 AST 节点而非 `$$` 定界符

`$$...$$` / `$...$` 定界符方案的根本毛病：前端要靠正则从纯字符串里切 LaTeX。正则切 LaTeX 极脆——公式内部可能有 `$`（货币）、转义、嵌套大括号；切错即崩。且 `answer` / `analysis` 是"文本 + 公式"混排，前端永远在猜哪段是公式。

AST 节点方案：后端直接返回结构化 `Block[]`，每个 block 自带 `type`。公式就是 `type: "formula"`，`latex` 是其字段。前端拿到 formula 节点，把 `latex` 原样喂给 `FormulaView`（底层 iosMath），**不存在"抽取"步骤，也就没有切错**。

### B 策略：单源真相，零迁移（已落地）

模型**只输出 `blocks`**，后端用 `blocksToPlainText()`（`packages/core/src/ai/structured/blocks.ts`，纯函数可单测）**派生**纯字符串字段，二者同响应返回。理由：

- `persist.ts` 把 `answer` / `analysis` / `exam_points` / `ai_feedback` 写入 **TEXT 列** —— `blocks` 只活在 API 响应 payload，**不入库**，存派生字符串 → **零 DB 迁移**。
- 多个字符串消费者（Web chat/grade 页、grade/analyze API 路由直接 `NextResponse.json(result)`、`types.ts` 的 `correctAnswerFromQuestion` 读 `answer` 为 string、`retrieve.ts` RAG 读 `analysis`、`runChatAgent.ts` 模板 `${result.analysis}` / `${result.summary}`）**全部继续读 string 字段，零改动**。
- iOS 优先读 `blocks`，缺省回退 string（降级为单个 `.text` block）。
- 单一事实源，string / blocks 永不矛盾；省 token（模型不重复输出）。

这是 §2.1「双字段过渡」的具体落地：string 字段不弃用，而是从 blocks 派生。

### 为什么 Geometry AST 而非 TikZ / 图片

- TikZ：纯 Swift 无现成渲染器，死路。
- 图片 URL：离线不可用、不可交互、放大模糊。
- Geometry AST：自定义节点（`triangle` / `circle` / `line` / `point` / `angle` / `coordinateSystem` / `functionCurve` + 坐标/参数）→ 前端 `Canvas` / `Shape` 画，矢量、清晰、离线、可交互。

---

## 2. 公式渲染（M1 — 进行中，刚需，边界清楚）

### 2.1 数据契约：`Block[]` AST

把 `analyze` / `gradeMath` 中公式密集的字段从 `string` 升级为 `Block[]`。ocr 的 `blocks` 已是 typed，对齐即可。

**统一 Block 类型**（前后端共享，对应 `packages/core` Zod + `ApiContracts` Swift）：

```ts
// packages/core/src/ai/prompt/format.ts（待改）
type Block =
  | { type: "text"; content: string }
  | { type: "formula"; latex: string }      // 纯 LaTeX，无 $ 定界符
  | { type: "image"; url: string; alt?: string };
```

```swift
// ApiContracts/Sources/ApiContracts/Models/ContentBlock.swift（待建）
public enum ContentBlock: Codable, Sendable {
    case text(content: String)
    case formula(latex: String)             // 纯 LaTeX，无 $$ 包裹
    case image(url: String, alt: String?)
}
```

**受影响字段**：

| 模型 | 字段 | 现状 | 目标 |
|------|------|------|------|
| `AnalyzeResponse` | `answer` | `String?` | `[ContentBlock]?` |
| `AnalyzeResponse` | `analysis` | `String` | `[ContentBlock]` |
| `AnalyzeResponse` | `examPoints` | `String?` | `[ContentBlock]?` |
| `GradeMathStep` | `feedback` | `String` | `[ContentBlock]` |
| `GradeMathResponse` | `summary` | `String` | `[ContentBlock]` |
| `GradeEssayResponse` | `summary` / `strengths` / `weaknesses` | `String` / `[String]` | `[ContentBlock]` / `[[ContentBlock]]`（作文公式极少，**暂不动**，留 string） |

**兼容策略**：后端可同时返回 `string` 与 `blocks` 双字段过渡，前端优先 `blocks`、缺省回退 `string`（降级为单个 `.text` block）。待后端全量切换后移除 string 字段。

### 2.2 后端 prompt 改动

`tasks.ts` 的 `analyze` / `gradeMath` 增加"分块输出"指令：

```
对于含数学公式的字段（answer/analysis/examPoints/feedback/summary），
请输出 blocks 数组而非纯字符串：
- 普通文字用 { "type": "text", "content": "..." }
- 数学公式用 { "type": "formula", "latex": "..." }（latex 为纯 LaTeX，不要 $ 包裹）
公式与文字分别成块，不要把公式混进 text。
```

`format.ts` 对应 schema 字段类型从 `z.string()` 改 `z.array(BlockSchema)`。

### 2.3 前端渲染架构

```
[ContentBlock]  (AST)
   ├ .text    → 现有 InlineParser → Text 拼接（保留）
   ├ .formula → FormulaView(latex:)  ← 新建，底层 iosMath
   └ .image   → AsyncImage(url:)
```

**`MarkdownRenderer` 升级**：从"解析 markdown 字符串"升级为"消费 `Block[]`"。
- 新增 init：`MarkdownRenderer(blocks: [ContentBlock])`。
- 保留现有 init：`MarkdownRenderer(_ markdown: String)`（内部包成单个 `.text` block，向后兼容；Chat / Plan 等纯文本场景继续用）。
- text block 走现有 `InlineParser`（`**bold**` / `*italic*` / `` `code` `` / `[link]()`）。
- formula block 走 `FormulaView`。

**`FormulaView`**（新建，`CoreKit/.../Components/FormulaView.swift`）：
- `public struct FormulaView: View`，`init(latex: String, fontSize: CGFloat = 17)`。
- 内部 `UIViewRepresentable` 包 `MTMathUILabel`（iosMath）。
- `@MainActor`（UIView 本身主线程隔离，Swift 6 严格并发安全）。
- 渲染失败（latex 非法）降级：`Text(latex).font(.system(.body, design: .monospaced))`。

### 2.4 iosMath 集成路径（待核实 agent 确认 fork/版本后定稿）

**候选**：`costism/iosMath`（ObjC/C++，`MTMathUILabel`，渲染质量最佳）。
**SPM 集成**：iosMath 原生无 SPM，需用社区 fork 或自包 wrapper。集成入 `CoreKit/Package.swift`：

```swift
// CoreKit/Package.swift（待改）
dependencies: [
    .package(path: "../ApiContracts"),
    .package(url: "<iosMath-SPM-fork-URL>", from: "<version>"),  // 待定
],
targets: [
    .target(name: "CoreKit", dependencies: ["ApiContracts", "iosMath"], path: "Sources/CoreKit"),
]
```

**严格并发**：`MTMathUILabel` 是 `UIView` → `@MainActor`。`FormulaView: UIViewRepresentable` 自动 `@MainActor`，Sendable 安全。需验证 Swift 6 `complete` 模式无警告。

**LaTeX 覆盖**（iosMath 已支持）：`\frac` / `\sqrt` / `^_` / 希腊字母 / `\sum \int \lim` / `\begin{matrix}` / `\begin{cases}` / `\left( \right)` 自适应定界符。**不支持**：`\text{}` 中文混排（公式内中文走 text block）、化学方程式、多行 `align` 对齐环境（降级为多 block）。

**风险**（Windows 无本地构建）：iosMath C++ 依赖首次集成可能需 2–3 轮 CI（`xcodegen` + `xcodebuild`）试错。缓解：先在 `FormulaView` 用纯 Swift Unicode 降级实现跑通管线，iosMath 作为可切换后端（`protocol MathBackend`）增量替换，**接口不变**。

### 2.5 受影响文件

| 文件 | 改动 |
|------|------|
| `packages/core/src/ai/prompt/format.ts` | analyze/gradeMath schema：string → Block[] |
| `packages/core/src/ai/prompt/tasks.ts` | analyze/gradeMath 指令加分块输出 |
| `packages/ios/ApiContracts/.../ContentBlock.swift` | **新建** ContentBlock enum |
| `packages/ios/ApiContracts/.../AnalyzeModels.swift` | answer/analysis/examPoints → [ContentBlock] |
| `packages/ios/ApiContracts/.../GradeModels.swift` | feedback/summary → [ContentBlock] |
| `packages/ios/CoreKit/Package.swift` | 加 iosMath 依赖（待核实） |
| `packages/ios/CoreKit/.../Components/FormulaView.swift` | **新建** iosMath 包装 |
| `packages/ios/CoreKit/.../Components/MarkdownRenderer.swift` | 加 `init(blocks:)`，formula block 走 FormulaView |
| `packages/ios/ios-gaokao/.../AnalysisResultView.swift` | `Text(answer)` → `MarkdownRenderer(blocks:)` |
| `packages/ios/CoreKit/.../Components/GradeResultView.swift` | feedback/summary → MarkdownRenderer(blocks:) |

---

## 3. 几何渲染（M2 — 待启动，尽量，边界开放，独立推进）

> 用户："图像的提示词随后跟上。" 本节先定 schema 草案与渲染架构，后端提示词待用户补充后填入。

### 3.1 为什么独立里程碑

几何 AST 与公式 AST 量级相当甚至更大，**不与公式混里程碑推**，避免几何 schema 设计拖慢公式（刚需）交付：

1. **无现成标准**：公式有 LaTeX 作 target；几何 AST 是自设计 DSL（三角形用三顶点 vs 两边一夹角？坐标系范围/刻度？函数曲线表达式 vs 采样点？标注如何挂？）。
2. **AI 输出可靠性待验**：AI 输出 LaTeX 是强项；输出自定义几何 JSON 是弱项，需测准确率。
3. **前端渲染器从零写**：每节点类型一个 drawer（三角形/角弧+度数/虚线高/坐标系箭头刻度/函数曲线采样），且要处理数学坐标↔屏幕坐标变换。
4. **覆盖面开放**：立体几何（三视图/二面角）、解析几何（圆锥曲线）、动态几何（动点轨迹）……会持续膨胀，不像公式一次收口。

### 3.2 Geometry AST schema 草案（v1 — 最小可用子集）

```ts
// v1 只覆盖最常见类，立体几何/圆锥曲线往后排
type GeometryAST =
  | { type: "scene"; elements: GeometryElement[]; bounds?: { xMin; xMax; yMin; yMax } }
  | { type: "coordinateSystem"; xRange: [number, number]; yRange: [number, number]; children: GeometryElement[] };

type GeometryElement =
  | { type: "point"; x: number; y: number; label?: string }
  | { type: "line"; from: [number, number]; to: [number, number]; style?: "solid" | "dashed"; label?: string }
  | { type: "triangle"; vertices: [[number, number], [number, number], [number, number]]; labels?: [string, string, string] }
  | { type: "circle"; center: [number, number]; radius: number; label?: string }
  | { type: "angle"; vertex: [number, number]; from: [number, number]; to: [number, number]; degrees?: number; label?: string }
  | { type: "functionCurve"; expr: string; /* LaTeX 子集表达式，如 "x^2" / "sin(x)" */ samples?: number; color?: string };
```

### 3.3 前端渲染架构

```
GeometryAST
   └ GeometryCanvasView  ← 新建，Canvas + 坐标变换层
        ├ CoordinateTransformer（数学坐标 ↔ 屏幕坐标，自适应缩放居中）
        └ per-element drawer（PointDrawer / LineDrawer / TriangleDrawer / ...）
```

`GeometryCanvasView`（新建，`CoreKit/.../Components/GeometryCanvasView.swift`）：
- `public struct GeometryCanvasView: View`，`init(ast: GeometryAST, frame: CGSize = ...)`
- 内部 `Canvas` 绘制 + `CoordinateTransformer` 处理坐标映射。
- v1 先跑通两 demo 验证可行性：**三角形 + 角标注**、**坐标系 + 一次/二次函数曲线**。

### 3.4 后端提示词（待用户补充）

> 占位：用户表示"图像的提示词随后跟上"。待提示词定稿后，填入 `tasks.ts` 的 analyze（几何题）分支，并在本节记录。
> 待定项：几何题如何识别为"需几何图" → 是新增 `geometryAst` 字段，还是 ocr blocks 中新增 `type: "geometry"` block？

### 3.5 受影响文件（M2）

| 文件 | 改动 |
|------|------|
| `packages/core/src/ai/prompt/tasks.ts` | analyze 几何分支提示词（待定） |
| `packages/core/src/ai/prompt/format.ts` | analyze schema 加 geometryAst |
| `packages/ios/ApiContracts/.../GeometryAST.swift` | **新建** |
| `packages/ios/CoreKit/.../Components/GeometryCanvasView.swift` | **新建** |
| `packages/ios/ios-gaokao/.../AnalysisResultView.swift` | 几何题渲染 GeometryCanvasView |

---

## 4. 推进顺序

1. **M1 公式**（当前）：后端 Block[] schema + prompt → 前端 ContentBlock + FormulaView + MarkdownRenderer 升级 → iosMath 集成（待核实 agent 确认 fork）。先以纯 Swift Unicode 降级实现跑通管线，iosMath 增量替换。
2. **M2 几何**（后续，独立）：先设计 Geometry AST schema v1 → 验 AI 输出准确率 → 写 GeometryCanvasView + 两 demo → 扩节点类型。后端提示词待用户补充后接入。

---

## 5. 验证

无法本地构建（Windows）。验证 = 读级审查（Swift 6 / 严格并发 / Sendable / `missing_docs`）+ 推非 main 分支触发 `ios-ci.yml`（macOS runner：ApiContracts/CoreKit `swift build`+`swift test` → `xcodegen generate` → `xcodebuild build`）。

iosMath C++ 依赖集成阶段预期需 2–3 轮 CI 试错（Windows 无本地 Mac，调试周期长）。纯 Swift 降级实现可读级审查覆盖大部分风险。

---

*文档版本：2026-08-08 · 公式 M1 进行中 / 几何 M2 待启动（提示词待补）*
