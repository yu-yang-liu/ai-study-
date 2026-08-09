# Visual AST —— 数学/理科示意图结构化渲染（开源子项目）

> 状态：**v1 已落地**（`packages/visual-ast`：schema + validator + SVG renderer + AI 提示词 + 示例 + playground）
> 基线：2026-08-09
> 关联：[RENDER_AST.md](./RENDER_AST.md) §3（M2 几何）、设计文件《AI Learning Intelligence Platform Architecture》§4 Visual AST / §8 Phase 2

---

## 0. 一句话定位

**图像不是图片，而是结构化数据。**

AI 把题目中的几何 / 函数 / 力学情境转换为 **Geometry AST**（JSON），渲染器把 AST 画成矢量图。整个过程不用图片 URL、不用 TikZ、不输出 UI 代码 —— 这正好是设计文件「AI → AST → Renderer → UI」的 Visual AST 子层。

## 1. 为什么独立成开源子项目

1. **跨端复用**：同一份 AST 由 Web / iOS / Android 各自渲染，协议是单点事实源。
2. **AI 输出可靠性待验**：AI 输出 LaTeX 是强项，输出自定义几何 JSON 是弱项 —— 需要 schema、validator 和 eval 一起交付。
3. **边界开放**：立体几何、圆锥曲线、动态几何、物理示意、分子结构会持续膨胀，独立演进比塞进 ai-study 主仓库更干净。
4. **可演示、可校验**：零依赖纯函数 + 单测 + playground，任何人 clone 即可跑。

## 2. 协议（v1）

### 根节点

```ts
type GeometryAST =
  | { type: "scene"; elements: GeometryElement[]; bounds?: { xMin; yMin; xMax; yMax } }
  | { type: "coordinateSystem"; xRange: [number, number]; yRange: [number, number]; xStep?; yStep?; showGrid?; children: GeometryElement[] };
```

### 元素

`point` / `line` / `vector` / `triangle` / `polygon` / `circle` / `arc` / `angle` / `functionCurve` / `label`

- `vector`：带箭头向量（力学示意图刚需）
- `angle`：由 `vertex/from/to` 三点自动画角弧 + 度数标注
- `functionCurve.expr`：初等函数表达式子集（+ - * / ^、sqrt/sin/cos/tan/abs/log/ln/exp/min/max），由 `src/expr.ts` 安全求值，**无 eval**

实现见 [packages/visual-ast/src/types.ts](../packages/visual-ast/src/types.ts)。

## 3. 渲染契约

`renderSVG(ast, opts?) → string`：

- 数学坐标（y 向上）→ SVG 屏幕坐标（y 向下），等比缩放居中；
- bounds 优先级：显式 `bounds` > 坐标轴 `xRange/yRange` > 元素自动适配；
- 每个元素类型一个独立 drawer，后续可扩展 `drawer` 注册表；
- 纯函数、无 DOM 依赖、可在 Node / 浏览器 / CI 中复用。

## 4. AI 提示词（v1 草案）

`packages/visual-ast/src/prompt.ts`：

- 系统提示词声明硬性禁止（图片 URL / TikZ / UI 代码 / 代码块外文字）；
- 定义 10 种元素与 functionCurve 表达式语法；
- 用户提示词把题目原文 + 可选补充说明转为"仅输出 JSON"。

> 待办：把提示词接入 ai-study 的 `analyze`（几何题分支），并用 `packages/core/src/ai/eval` 测 AI 输出准确率。

## 5. 示例

| 样例 | 覆盖 |
|------|------|
| `triangleWithAngle` | 三角形 + 角标注（平面几何） |
| `coordinateParabola` | 坐标系 + 二次函数 + 一次函数（解析几何） |
| `circleInscribedTriangle` | 圆 + 内接三角形 + 虚线辅助线 |
| `forceDiagram` | 力的合成（向量 + 平行四边形） |
| `rightTriangle` | 直角标记 |

预览：`node scripts/preview.mjs` 生成 `preview/*.svg|png`。

## 6. 与 ai-study 的集成计划

1. **后端 task**：`packages/core/src/ai` 新增 `geometry` 任务（schema 复用 visual-ast validator + zod 适配），prompt 接入 analyze 几何分支。
2. **准确率评估**：把内置样例扩成 eval cases，用 `packages/core/src/ai/eval` 测模型输出。
3. **跨端渲染器**：
   - Web：React + SVG（直接复用 `renderSVG`）；
   - iOS：SwiftUI `Canvas`（GeometryCanvasView + CoordinateTransformer）；
   - Android：Compose `Canvas`。
4. **内容接入**：ocr 块中新增 `type: "geometry"` 或 `analyze` 新增 `geometryAst` 字段（二选一，先定协议再定位置）。

## 7. 路线图

| 里程碑 | 内容 | 状态 |
|--------|------|------|
| v1 | schema + validator + SVG renderer + 提示词 + 示例 + playground | ✅ |
| v2 | Web React 组件 / 动态几何（拖动、轨迹）/ relation 节点（垂直、平行标记） | 待启动 |
| v3 | iOS SwiftUI Canvas / Android Compose Canvas | 待启动（需 macOS/Android 构建环境） |
| v4 | 物理实验示意、化学分子结构（图谱布局）、圆锥曲线 | 待启动 |
| v5 | 开源发布：JSON Schema 导出、版本化协议、多语言提示词、独立仓库 | 待启动 |

## 8. 验证

```bash
cd packages/visual-ast
node --test src/*.test.ts      # 32 用例
tsc --noEmit -p tsconfig.json  # 类型检查
node scripts/preview.mjs       # 生成预览
```

*文档版本：2026-08-09 · visual-ast v1*
