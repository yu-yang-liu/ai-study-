# 几何提示词定稿与 Eval 准确率方案

> 状态：**M-A/M-B 已完成**（geometry schema/task/prompt 定稿 + eval 基建；M-C 真跑 eval 待 key）
> 基线：2026-08-09 · 对应 [SCIENCE_AST_IOS_ROADMAP.md](./SCIENCE_AST_IOS_ROADMAP.md) V2 剩余项
> 关联：设计文件 §4 Visual AST、[RENDER_AST.md](./RENDER_AST.md) §3.4（提示词待补）、[VISUAL_AST.md](./VISUAL_AST.md) §4

---

## 0. 目标

1. **几何提示词定稿**：让 AI 稳定地把题目中的几何 / 函数 / 力学情境转成 Geometry AST（而非图片 URL / TikZ / UI 代码）。
2. **Eval 准确率**：用人工标注用例量化「AI 输出 geometryAst 的准确率」，不达标就迭代提示词，达标后再接入 analyze 生产链路。

---

## 1. 协议决策（先定，避免返工）

### 1.1 几何图在 API 内容中的表达

**确认**：几何图作为 `visual` block 出现（`{ "type": "visual", "kind": "geometry", "geometry": {...} }`），不再新增顶层 `geometryAst` 字段。

- V1 已定义 `visual` block，V2 的 iOS `ContentBlock.visual(kind:geometry:)` + `GeometryCanvasView` 已能消费；
- analyze / gradeMath / chat 的 blocks 数组天然支持，AI 自行判断"这题需不需要图"；
- RENDER_AST §3.4 的"待定项"就此关闭。

### 1.2 新增内部 `geometry` task（仅 eval / 提示词迭代用，不暴露 API）

输入题目文本 → 输出 `{ "geometry": GeometryAST | null, "reason": string }`。

- 好处：eval 聚焦、便宜、迭代快；生产路径（analyze blocks）复用同一份 prompt 核心。
- 落点：
  - `packages/core/src/ai/gateway/types.ts`：`TaskName` 增加 `'geometry'`；`TASK_ROUTING` 增加 `{ capability: 'text-reasoning', temperature: 0.1, jsonMode: true }`。
  - `packages/core/src/ai/structured/schemas.ts`：新增 `geometryAstSchema` / `geometryOutputSchema`（与 visual-ast v1 对齐，独立移植到 core 以免 workspace 依赖）。

---

## 2. 提示词定稿

### 2.1 权威版本位置

- 权威版放 **`packages/core/src/ai/prompt/geometry.ts`**（生产代码直接引用）。
- `packages/visual-ast/src/prompt.ts` 保留为 v1 草案，注释指向 core 权威版；如 visual-ast 独立发布，再从 core 回填。

### 2.2 定稿结构（`GEOMETRY_SYSTEM_PROMPT`）

1. **角色**：数学 / 物理 / 化学示意图的结构化生成器，只输出 JSON。
2. **硬性禁止**：图片 URL、TikZ、SVG/Canvas 代码、Markdown 代码块、JSON 之外的任何文字。
3. **坐标系**：数学坐标（x 右、y 上），原点缺省 (0,0)，角度单位「度」；坐标必须是数字。
4. **元素清单**（10 种，含字段示例）：
   `point` / `line` / `vector` / `triangle` / `polygon` / `circle` / `arc` / `angle` / `functionCurve` / `label`。
5. **functionCurve.expr 语法白名单**：`+ - * / ^`、括号、变量 `x`、`pi/e`、`sqrt/sin/cos/tan/asin/acos/atan/abs/log/ln/exp/min/max`；显式乘法（`2*x`），不支持隐式乘法。
6. **根节点选择规则**：
   - 需要坐标轴（函数图像、解析几何）→ `coordinateSystem`（给 xRange/yRange）；
   - 平面几何 / 力学示意 / 立体投影 → `scene`（可省 bounds，渲染器自动适配）。
7. **何时输出图**：几何证明/计算、函数图像、力学示意图、立体图 → 输出；纯代数、概念问答、不需要图形 → `geometry: null`。
8. **最少元素原则**：只画题目需要；不加装饰性元素；辅助线用 `style:"dashed"`。
9. **标注规则**：顶点用大写字母（A/B/C…），中文说明用 `label`；角度用 `angle` 元素带 `degrees`。
10. **JSON 契约 + 示例**：内置 2 个 few-shot（三角形+角、坐标系+抛物线）。

### 2.3 三份变体（共享同一核心）

| 变体 | 用途 | 输出 |
|------|------|------|
| `geometry` task 完整版 | eval / 提示词迭代 | `{ geometry, reason }` |
| `GEOMETRY_BLOCK_INSTRUCTION` 片段 | analyze/gradeMath 的 BLOCK_INSTRUCTION 追加 | 需要图时在 blocks 中输出 visual block |
| `analyzeImg` 拍照场景 | 拍照题（Phase 2 后期） | 与完整版一致 |

### 2.4 错误修复循环

- 复用 `structuredCall` 重试机制：schema 校验失败 → 把 zod 错误信息（含路径）喂回模型重试一次；
- geometry 专属修复提示：`geometryAst 校验失败：<errors>。请检查元素类型、坐标、angle 的 vertex/from/to、functionCurve.expr 语法后重新输出。`

### 2.5 输出约束（防失控）

- 元素数量 ≤ 20；
- 坐标绝对值 ≤ 100，半径 > 0 且 ≤ 100；
- `expr` 长度 ≤ 80；非法表达式由 eval 记为 expression 维度 0 分；
- `bounds` 可选，出现时必须 min < max。

---

## 3. Eval 设计

### 3.1 人工标注用例（`packages/core/src/ai/eval/geometry-samples.ts`）

首版 8 个 case（含 1 个负例）：

| # | 题目 | 期望 geometry |
|---|------|--------------|
| 1 | 三角形 ABC，∠A=60°，求面积 | scene: triangle + angle(60°) + labels A/B/C |
| 2 | 画出 y=x² 与 y=x+2 的图像 | coordinateSystem + 2 条 functionCurve |
| 3 | 圆 O 内接三角形 ABC | scene: circle + triangle + point O + 虚线 OA/OB/OC |
| 4 | 两个力 F₁、F₂ 的合成 | scene: vectors + 平行四边形虚线 |
| 5 | 直角三角形 ABC，∠A=90° | scene: triangle + angle(90°) |
| 6 | 一次函数 y=x+1 过点 (0,1)、(1,2) | coordinateSystem + line/functionCurve + 2 points |
| 7 | 解方程 2x+4=10（纯代数） | **geometry: null**（负例） |
| 8 | 三角形高 AD（D 在 BC 上） | scene: triangle + 虚线高 + 直角标记 |

### 3.2 打分维度（`packages/core/src/ai/eval/geometry-scoring.ts`）

每个维度 0–1，加权求和：

| 维度 | 说明 | 权重 |
|------|------|------|
| `validity` | validator 通过（含 JSON 解析） | 2.0 |
| `nullCase` | 负例必须输出 null；输出图形即 0 分 | 1.0 |
| `rootType` | scene / coordinateSystem 根类型匹配 | 1.0 |
| `elementRecall` | 期望元素类型集合在输出中的覆盖率 | 1.2 |
| `elementPrecision` | 惩罚多余/无关元素 | 0.8 |
| `coordinate` | 可匹配元素的坐标欧氏距离容差 0.5（逐元素平均） | 1.5 |
| `angle` | 期望角度 ±2° | 1.0 |
| `expression` | functionCurve 在 21 个采样点 MAE ≤ 0.1 | 1.0 |
| `labels` | 顶点标注（A/B/C）匹配率 | 0.6 |

- case 通过阈值：`overallScore ≥ 0.7`（与现有 eval 一致）；
- **整体达标**：case 通过率 ≥ 80% 且平均分 ≥ 0.75；
- **额外指标**：非法输出率 < 10%、负例正确率 ≥ 80%。

### 3.3 运行与报告

```bash
# packages/core 新增 script
pnpm --filter @ai-study/core eval:geometry
```

输出：每个 case 的维度分 + geometry JSON（可复用 visual-ast SVG 渲染预览）+ 汇总报告。

### 3.4 局限说明（第一版）

- 坐标对比用绝对坐标 + 容差；不处理「整体平移/旋转/缩放」的几何等价（第二版再做相对几何匹配）；
- `expression` 只做采样对比，不做符号等价（`(x+1)^2` vs `x^2+2x+1` 视为不等，但采样差值可接受）；
- bounds 自动适配，不作为打分项。

---

## 4. 实施步骤

### 实施记录（2026-08-09）

- [x] **M-A**：`geometryAstSchema` / `geometryOutputSchema` + `geometry` task 注册（TASK_ROUTING/TASK_SCHEMA/TASK_INSTRUCTIONS/FORMATS）；`prompt/geometry.ts` 定稿（GEOMETRY_SYSTEM_PROMPT + GEOMETRY_BLOCK_INSTRUCTION + buildGeometryUserPrompt）；BLOCK_INSTRUCTION 已追加几何 visual block 片段。
- [x] **M-B**：`geometry-samples.ts`（8 例含负例）+ `geometry-scoring.ts`（9 维度加权打分）+ `geometry-math.ts`（安全表达式求值）+ `geometry-eval.test.ts`（纯函数 7 例全绿 + key 驱动集成 eval）；`pnpm --filter @ai-study/core eval:geometry` 可跑。
- [ ] **M-C**：真跑 eval（需 DeepSeek API key）→ 迭代提示词 → 达标报告。
- [ ] **M-D**：analyze 生产链路接入 visual block + iOS 端到端（macOS CI）。

| 步骤 | 内容 | 可本地验证（无 key） |
|------|------|---------------------|
| M-A | core：`geometryAstSchema` + `geometryOutputSchema` + `geometry` task 注册 + prompt v2 定稿 + BLOCK_INSTRUCTION 片段 | ✅ schema 单测 |
| M-B | eval 基建：`geometry-samples.ts` + `geometry-scoring.ts` + `run-geometry-eval` script | ✅ scoring/样本单测 |
| M-C | 真跑 eval（需 DeepSeek API key）→ 迭代提示词 → 达标报告 | ❌ 需 key |
| M-D | analyze 接入 visual block（生产链路）+ iOS 端到端（macOS CI） | ❌ 需 key + CI |

---

## 5. 依赖与风险

- **DeepSeek API key**：M-C/M-D 必须；无 key 时只能完成 M-A/M-B 的 schema 与打分单测。
- **AI 输出自定义 JSON 的可靠性**：这正是 eval 要量化的；预期需要 2–3 轮提示词迭代。
- **多解与几何等价**：第一版用绝对坐标容差，标注局限；若真实场景大量出现平移/旋转等价，第二版升级匹配算法。
- **Windows 环境**：eval 是纯 Node，可本地跑；iOS 端到端仍需 macOS CI。

---

*文档版本：2026-08-09 · 待执行（M-A 可立即开始）*
