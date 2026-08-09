# 公式与几何渲染 — AST 渲染方案

> 状态：**公式 M1 实施完成（iOS CI 全绿）/ 几何 M2 核心完成（M-D 端到端通过，2026-08-09）**
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

## 2. 公式渲染（M1 — 实施完成，iOS CI 已验证，刚需，边界清楚）

### 2.1 数据契约：`Block[]` AST

把 `analyze` / `gradeMath` 中公式密集的字段从 `string` 升级为 `Block[]`。ocr 的 `blocks` 已是 typed，对齐即可。采用 **B 策略**（见上「B 策略」段）：模型只输出 `*Blocks`，后端 `blocksToPlainText()` 派生同名 string 字段，二者同响应返回。string 字段**不弃用**，继续供 Web / 持久化 / chat 模板消费。

**统一 Block 类型**（前后端共享，对应 `packages/core` Zod + `ApiContracts` Swift）：

```ts
// packages/core/src/ai/structured/schemas.ts（已落地）
const blockSchema = z.object({
  type: z.enum(['text', 'formula', 'image']),
  content: z.string().optional(),   // text 用；ocr 旧 blocks 的 formula 也落 content，兼容
  latex: z.string().optional(),      // formula 用
  url: z.string().optional(),
  alt: z.string().optional(),
});
type Block = z.infer<typeof blockSchema>;
```

```swift
// ApiContracts/Sources/ApiContracts/Models/ContentBlock.swift（已落地）
public enum ContentBlock: Codable, Sendable, Equatable {
    case text(content: String)
    case formula(latex: String)             // 纯 LaTeX，无 $$ 包裹；解码时 latex 缺则回退 content（兼容 ocr 旧格式）
    case image(url: String, alt: String?)
    // init(from:): 未知 type → 降级 .text("")，避免整响解码失败
}
```

**受影响字段**（新增可选 `*Blocks`，原 string 字段保留并由后端派生）：

| 模型 | 字段 | 现状 | 新增 |
|------|------|------|------|
| `AnalyzeResponse` | `answer` | `String?` | `answerBlocks: [ContentBlock]?` |
| `AnalyzeResponse` | `analysis` | `String` | `analysisBlocks: [ContentBlock]?` |
| `AnalyzeResponse` | `examPoints` | `String?` | `examPointsBlocks: [ContentBlock]?` |
| `GradeMathStep` | `feedback` | `String` | `feedbackBlocks: [ContentBlock]?` |
| `GradeMathResponse` | `summary` | `String` | `summaryBlocks: [ContentBlock]?` |
| `GradeEssayResponse` | `summary` / `strengths` / `weaknesses` | `String` / `[String]` | **不动**（作文公式极少，留 string） |

**兼容策略**：后端同响应返回 string（派生）与 blocks（模型输出）。iOS 优先 `blocks`、缺省回退 `string`（降级为单个 `.text` block）。字段全可选，旧响应缺 `*Blocks` → 解码为 nil 不崩。

### 2.2 后端 prompt 与派生改动

`tasks.ts` 的 `analyze` / `gradeMath` / `analyzeImg` 增加"分块输出"指令：

```
对于含数学公式的字段（answer/analysis/examPoints/feedback/summary），
请输出 blocks 数组而非纯字符串：
- 普通文字用 { "type": "text", "content": "..." }
- 数学公式用 { "type": "formula", "latex": "..." }（latex 为纯 LaTeX，不要 $ 包裹）
公式与文字分别成块，不要把公式混进 text。
（string 字段由后端派生，模型无需输出。）
```

`format.ts` 对应 schema 字段从 `z.string()` 改 `z.array(blockSchema)`，静态 map 展示 `*Blocks` 数组示例。

**派生回填**（`learning/actions.ts`，`executeAnalyze` / `executeGrade`）：`structuredCall` 返回后、`persist*` 之前，用 `blocksToPlainText(result.answerBlocks)` 等回填同名 string 字段；`analysis` 为必填，派生作回退（`blocksToPlainText(...) || result.analysis`）。`persist*` 签名不变（仍收 string）。`runChatAgent.ts` 模板读 string 字段，**零改动**。

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

**`FormulaView`**（已落地，`CoreKit/.../Components/FormulaView.swift`）：
- `public struct FormulaView: View`，`init(latex: String, fontSize: CGFloat = 17)`。
- `public protocol MathBackend: Sendable { func render(latex:fontSize:) -> AnyView }` —— 阶段一 `UnicodeMathBackend`（纯 Swift Unicode 降级，零依赖，CI 可跑），阶段二 `IosMathBackend`（iosMath `MTMathUILabel`）。`defaultBackend` 用 `#if canImport(iosMath)` 切换，调用方零改动。
- `UnicodeMathBackend.convert()` 纯函数：`\sqrt`→√、`\frac{a}{b}`→a/b、`^{2}`→²、`_{n}`→ₙ、希腊字母… 未识别命令保留字母名去反斜杠，信息不丢。13 项单测覆盖。
- `IosMathBackend`（`@MainActor`，`nonisolated render` 返回 `AnyView`）：`UIViewRepresentable` 包 `MTMathUILabel`，抄自 iosMath `SwiftMathExample/MathLabel.swift`（MIT）。解析失败降级：`updateUIView` 设 `latex` 后读 `label.error`，非空则经 `@Binding` 翻转包装视图 `fallback`，body 切到 `UnicodeMathBackend`。`sizeThatFits` 限定宽度为提案宽度，防宽公式撑爆列宽。

### 2.4 iosMath 集成路径（已核实并落地）

**仓库**：`kostub/iosMath`（**非 `costism`**，后者 404）。MIT。**自 2.0.0 起原生 SPM**（CocoaPods 已移除），`swift-tools-version: 6.0`，`.iOS(.v13)` / `.macOS(.v10_15)`，与 CoreKit `.iOS(.v17)` 兼容（SPM 取平台并集，无冲突）。

**Pin `from: "2.5.0"`**（2026-07-14 最新）。**必须 ≥2.3.1**（issue #215 `MTMathList.h not found` 修复于 PR #217，部署目标降回 iOS 13+）。

**SPM 集成**（已落地 `CoreKit/Package.swift`）：

```swift
dependencies: [
    .package(path: "../ApiContracts"),
    .package(url: "https://github.com/kostub/iosMath.git", from: "2.5.0"),
],
targets: [
    .target(name: "CoreKit", dependencies: ["ApiContracts", "iosMath"], path: "Sources/CoreKit"),
]
```

**project.yml**：iosMath **无需在 `packages:` 显式声明** —— XcodeGen 解析 CoreKit `Package.swift` 时传递性拉取。`xcodeVersion` bump `"16.0"` → `"16.2"`（macOS-15 runner 有 `Xcode_16.2.app`；CI `ios-ci.yml` 同步 `xcode-select` 到该路径）。fallback：若 CI 实测 xcodegen 未传递 iosMath，再在 `packages:` 显式加。

**严格并发**：`MTMathUILabel` 是 `UIView` → 天然 `@MainActor`。`IosMathBackend` 标 `@MainActor`，`render` 标 `nonisolated`（构造视图值不触 actor 隔离态，`makeUIView` / `updateUIView` 由 SwiftUI 调度到主线程）。`defaultBackend` 是只读 `static var`，无并发写竞争。Swift 6 `complete` 模式无警告（iOS CI 已验证）。

**LaTeX 覆盖**（iosMath 已支持）：`\frac` / `\sqrt` / `^_` / 希腊字母 / `\sum \int \lim` / matrix / `array`(v2.5.0) / `cases` / `\left( \right)` / `aligned` / `split` / `gather` / `\text{}` CJK(v2.2.0) / `\phantom` `\smash` `\overset` `\underset`(v2.4.0) / `\textcolor`(v2.5.0) / accents / `\cancel`(v2.5.0)。**不支持**：`align` / `equation` 环境、多行换行、mhchem 化学方程式、`\newcommand`。v2.4.0+ 全局字体/符号表线程安全。

**风险**（Windows 无本地构建）：iosMath C++ 依赖首次集成预期 1–3 轮 CI 试错。缓解：`MathBackend` 协议 + 纯 Swift `UnicodeMathBackend` 降级实现已跑通全管线（阶段一 CI 必须全绿，这是去风险基线），iosMath 作为可替换后端第二步接入，**接口不变**。即使 iosMath 首轮挂，STEP 1–5/7 已可用。

### 2.5 受影响文件

| 文件 | 改动 |
|------|------|
| `packages/core/src/ai/structured/schemas.ts` | blockSchema + analyze/gradeMath 新增 `*Blocks` 可选字段 |
| `packages/core/src/ai/structured/blocks.ts` | **新建** `blocksToPlainText()` 纯函数（派生 string，单源真相） |
| `packages/core/src/ai/structured/blocks.test.ts` | **新建** `blocksToPlainText` 单测（三类 block / 空 / null） |
| `packages/core/src/learning/actions.ts` | `executeAnalyze`/`executeGrade` 派生回填 string 字段 |
| `packages/core/src/ai/prompt/format.ts` | analyze/gradeMath schema 展示 `*Blocks` 数组示例 |
| `packages/core/src/ai/prompt/tasks.ts` | analyze/gradeMath/analyzeImg 指令加分块输出 |
| `packages/core/src/index.ts` | 导出 `blocksToPlainText`、`Block` |
| `packages/ios/ApiContracts/.../ContentBlock.swift` | **新建** ContentBlock enum（判别 Codable，未知 type 降级） |
| `packages/ios/ApiContracts/.../AnalyzeModels.swift` | answer/analysis/examPoints 加 `*Blocks` + CodingKeys |
| `packages/ios/ApiContracts/.../GradeModels.swift` | feedback/summary 加 `*Blocks` |
| `packages/ios/ApiContracts/Tests/.../ContentBlockTests.swift` | **新建** 14 项解码/容错/整响测试 |
| `packages/ios/CoreKit/Package.swift` | 加 iosMath `from: "2.5.0"` 依赖 |
| `packages/ios/CoreKit/.../Components/FormulaView.swift` | **新建** MathBackend 协议 + UnicodeMathBackend（阶段一）+ IosMathBackend（阶段二） |
| `packages/ios/CoreKit/Tests/.../UnicodeMathBackendTests.swift` | **新建** 13 项 convert 单测 + defaultBackend 条件断言 |
| `packages/ios/CoreKit/.../Components/MarkdownRenderer.swift` | 加 `init(blocks:)`，formula block 走 FormulaView |
| `packages/ios/ios-gaokao/.../AnalysisResultView.swift` | `Text(answer)` → `MarkdownRenderer(blocks:)`（blocks 优先、回退 string） |
| `packages/ios/ios-gaokao/project.yml` | `xcodeVersion` "16.0"→"16.2" |
| `packages/ios/CoreKit/.../Components/GradeResultView.swift` | feedback/summary → MarkdownRenderer(blocks:) |
| `.github/workflows/ios-ci.yml` | `xcode-select` 路径 → `Xcode_16.2.app` |

---

## 3. 几何渲染（M2 — 核心完成，边界开放，扩展见 [GEOMETRY_V2_EXTENSIONS.md](./GEOMETRY_V2_EXTENSIONS.md)）

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

> 已定（2026-08-09）：几何图作为 `visual` block（`kind:"geometry"` + Geometry AST）表达；生产链路采用「独立 `geometry` task 后置检测 + attach 到 analysisBlocks」（analyze 主提示词只保留弱信号，实测不可靠）。
> 协议决策与 M-D 实施记录见 [GEOMETRY_PROMPT_EVAL.md](./GEOMETRY_PROMPT_EVAL.md)。

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

1. **M1 公式**（实施完成，iOS CI 全绿）：后端 Block[] schema + 派生 string + prompt → 前端 ContentBlock + FormulaView（MathBackend 协议：UnicodeMathBackend 阶段一 + IosMathBackend 阶段二）+ MarkdownRenderer(blocks:) 升级 → App 视图接入 → iosMath SPM 集成（`kostub/iosMath from:2.5.0`）。纯 Swift 降级实现跑通管线为去风险基线，iosMath 增量替换。
2. **M2 几何**（核心完成，2026-08-09）：Geometry AST schema v1（严格字段校验）→ geometry task eval 8/8 → GeometryCanvasView + demos → analyze 生产链路端到端（后置 attach）。扩展：eval v2 相对匹配、立体/圆锥曲线节点、化学 graph 布局（见 [GEOMETRY_V2_EXTENSIONS.md](./GEOMETRY_V2_EXTENSIONS.md)）。

---

## 5. 验证

无法本地构建（Windows，无 swift toolchain）。验证 = 读级审查（Swift 6 / 严格并发 / Sendable / `missing_docs`）+ 推非 main 分支触发 `ios-ci.yml`（macOS-15 runner：ApiContracts/CoreKit `swift build`+`swift test` → `xcodegen generate` → `xcodebuild build`，失败上传 `xcode-logs` artifact）。

**阶段一（纯 Swift Unicode 降级）CI 必须全绿** —— 无 iosMath 依赖，应一次过，这是去风险基线。**阶段二（加 iosMath）** 进入 1–3 轮 CI 试错窗口：首轮关注 `MTMathList.h not found`（已 pin ≥2.3.1）、module 未解析（project.yml 显式加 iosMath package）、C++ 链接。即使 iosMath 首轮挂，STEP 1–5/7 已可用（降级路径保证管线本身可独立验证）。

后端验证：`pnpm exec tsc --noEmit && pnpm exec vitest run`（含 `blocksToPlainText` 单测）。人工核零破坏：Web chat/grade 页、API 路由、RAG、chat 模板继续吃 string 字段不崩。

---

*文档版本：2026-08-09 · 公式 M1 实施完成（iOS CI 全绿）/ 几何 M2 核心完成（M-D 端到端通过）*
