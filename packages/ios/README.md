# iOS 客户端 — Swift Package 清单

本目录为 **ai-study** 单学段（高中）iOS 原生客户端，包含共享 Swift Package 与一个 App Target。

> 目录名 `ios-gaokao` 为历史遗留，仅保留 Xcode 工程路径稳定；中考端 `ios-zhongkao` 已移除。

## 结构

```
packages/ios/
├── ApiContracts/          # API 契约模型层（Swift Codable）
├── CoreKit/               # 共享基础设施（网络、认证、UI）
├── ios-gaokao/            # App Target（XcodeGen + SwiftUI）
└── tools/                 # 图标生成脚本（独立 npm，不在 pnpm workspace）
```

## 依赖关系

```
ios-gaokao (App Target)
    └── CoreKit (Swift Package)
            └── ApiContracts (Swift Package)
```

后端契约对应：`apps/web` API 路由 + `packages/core` Zod schema。

Chat / 对话历史：`POST /api/chat`、`GET /api/chat/history`（`conversationId`）。Agent Memory 路线图见仓库根目录 [docs/AGENT_MEMORY.md](../../docs/AGENT_MEMORY.md)（M1–M6 待建设；iOS `ChatViewModel` 已接 history）。

## 构建

```bash
# 构建 ApiContracts
cd packages/ios/ApiContracts
swift build && swift test

# 构建 CoreKit（依赖 ApiContracts）
cd packages/ios/CoreKit
swift build && swift test

# 生成并打开 App 工程（需 macOS + xcodegen）
cd packages/ios/ios-gaokao
xcodegen generate --spec project.yml
```

## 环境配置

- `CoreKit/AppEnvironment.swift`：`phase = "high"`，`keychainServiceName = "com.aistudy.app"`
- App `Info.plist` 通过 `API_BASE_URL` 注入服务端地址（Debug/Release 在 `project.yml` 配置）

## 公式与几何渲染（进行中）

数学/理科公式与几何图形的原生渲染方案，详见 [docs/RENDER_AST.md](../../docs/RENDER_AST.md)。

**核心思路**：不依赖 Markdown `$$` 定界符，公式作为 AST 节点（`ContentBlock.formula(latex:)`），由 `FormulaView`（底层 iosMath）渲染；几何采用 Geometry AST + Swift `Canvas`/`Shape` 动态渲染，不依赖图 URL / TikZ。

| 里程碑 | 范围 | 状态 |
|--------|------|------|
| **M1 公式**（刚需） | 后端 `answer`/`analysis`/`examPoints`/`feedback`/`summary` 升级为 `Block[]`；前端 `ContentBlock` + `FormulaView` + `MarkdownRenderer(blocks:)` 升级；iosMath 集成 | 进行中 |
| **M2 几何**（尽量，独立） | Geometry AST schema + `GeometryCanvasView` + 各节点 drawer；后端提示词待补 | 待启动 |

**当前进度**：
- [x] 设计文档 `docs/RENDER_AST.md`
- [ ] 后端 `format.ts` / `tasks.ts` schema 改 `Block[]`
- [ ] ApiContracts `ContentBlock.swift`
- [ ] `FormulaView.swift`（iosMath 包装，先纯 Swift Unicode 降级跑通管线）
- [ ] `MarkdownRenderer(blocks:)` 升级
- [ ] `AnalysisResultView` / `GradeResultView` 接入
- [ ] iosMath SPM 集成（待核实 fork/版本，预期 2–3 轮 CI 试错）

> 渲染方式：**方式一** —— iosMath 管公式排版，SwiftUI 管壳与交互，不用 WebView 全包。
