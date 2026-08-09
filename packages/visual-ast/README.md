# visual-ast

数学 / 物理 / 化学示意图的结构化协议与渲染器 —— **AI → AST → Renderer**。

图像不是图片，而是结构化数据。AI 负责理解题目并输出 Geometry AST，渲染器负责把 AST 画成图：矢量、清晰、离线可用、可交互、可校验。

> 状态：v1 草案（核心协议 + 校验器 + 纯 SVG 渲染器 + AI 提示词 + 示例）。
> 对齐 [docs/VISUAL_AST.md](../../docs/VISUAL_AST.md) 与设计文件《AI Learning Intelligence Platform Architecture》Phase 1–2。

## 设计原则

- **禁止**图片 URL、TikZ、SVG/Canvas 代码作为 AI 输出 —— AI 只输出结构化 AST。
- 坐标系为数学坐标：x 向右，y 向上；角度单位「度」。
- 渲染器负责数学坐标 ↔ 屏幕坐标映射与自适应适配。
- 零运行时依赖、纯函数、可单测；同一份 AST 可在 Web / iOS / Android 复用。

## 已实现（v1）

| 模块 | 文件 | 说明 |
|------|------|------|
| 类型 | `src/types.ts` | `scene` / `coordinateSystem` + 10 种元素 |
| 校验器 | `src/validate.ts` | 带路径错误信息，可喂回 AI 修复提示 |
| 边界 | `src/bounds.ts` | 显式 bounds / 坐标轴范围 / 元素自动适配 |
| 表达式 | `src/expr.ts` | 安全求值（无 eval），支持初等函数 |
| 渲染器 | `src/render.ts` | 纯 SVG 字符串，无 DOM 依赖 |
| 提示词 | `src/prompt.ts` | AI → Geometry AST 生成指令（中文 v1） |
| 示例 | `src/samples.ts` | 三角形+角、抛物线、内接圆、力学矢量等 |
| 测试 | `src/*.test.ts` | node:test，32 用例 |

元素：`point` / `line` / `vector` / `triangle` / `polygon` / `circle` / `arc` / `angle` / `functionCurve` / `label`。

## 快速开始

环境：Node ≥ 22.18（本包使用 Node 原生 TypeScript type stripping，无需编译安装）。

```bash
# 类型检查（复用仓库根目录 typescript）
node ../../node_modules/.bin/tsc.cmd --noEmit -p tsconfig.json   # Windows
# 或：tsc --noEmit -p tsconfig.json（已安装全局 tsc）

# 测试
node --test src/*.test.ts

# 生成示例 SVG / PNG 预览（PNG 依赖工作区中的 sharp）
node scripts/preview.mjs

# 构建 playground（依赖工作区中的 esbuild；在受限沙箱内需放开目录访问）
node scripts/build-demo.mjs
```

打开 `demo/index.html` 即可交互式编辑 AST 并实时预览渲染结果。

## 最小示例

```ts
import { renderSVG } from "./src/render.ts";
import { samples } from "./src/samples.ts";

const svg = renderSVG(samples.triangleWithAngle);
// <svg ...><polygon .../><path .../>60°</svg>
```

一个三角形 + 60° 角的 AST：

```json
{
  "type": "scene",
  "elements": [
    { "type": "triangle", "vertices": [[0,0],[5,0],[2,3.5]], "labels": ["A","B","C"] },
    { "type": "angle", "vertex": [0,0], "from": [5,0], "to": [2,3.5], "degrees": 60 }
  ]
}
```

## 路线图

- 跨端渲染器：Web（React/SVG）、iOS（SwiftUI Canvas）、Android（Compose Canvas）
- 动态几何：拖动顶点、辅助线、轨迹
- 学科扩展：物理实验示意、化学分子结构（图谱布局）
- 与 ai-study 集成：`geometry` task + AI 输出准确率评估（复用 `packages/core/src/ai/eval`）
- 开源发布：schema 版本化、JSON Schema 导出、多语言提示词

## License

MIT
