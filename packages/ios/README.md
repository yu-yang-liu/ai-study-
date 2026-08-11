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

Chat / 对话历史：`POST /api/chat`、`GET /api/chat/history`（`conversationId`）。Agent Memory 六项能力（M1–M6）已全部落地，见仓库根目录 [docs/AGENT_MEMORY.md](../../docs/AGENT_MEMORY.md)；iOS `ChatViewModel` 已接 history。

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
- App `Info.plist` 通过 `API_ENVIRONMENT` 和 `API_BASE_URL` 注入运行环境
- `Debug` 使用 development 配置
- `Staging` 使用 `AISTUDY_API_BASE_URL_STAGING` 构建设置注入真实地址
- `Release` 使用 `AISTUDY_API_BASE_URL_PRODUCTION` 构建设置注入真实地址，并使用 `AISTUDY_DEVELOPMENT_TEAM` 注入 Apple Team ID
- 非 development 环境如果仍使用 `example.com` 或未解析的 `$(...)` 占位地址，Release 会直接阻止启动
- `ios-gaokao/Config/validate-build-settings.sh` 会在 Staging / Release 构建前拒绝缺失、非 HTTPS 或占位地址
- App Store Connect 导出模板见 `ios-gaokao/Config/ExportOptions-AppStoreConnect.plist.example`
- iOS CI 会执行 unsigned Release archive，验证工程可以生成可归档产物；正式签名和 TestFlight 上传仍需要 Apple Team、证书和 profile

示例：

```bash
export AISTUDY_API_BASE_URL_STAGING
export AISTUDY_DEVELOPMENT_TEAM

xcodebuild \
  -project ios-gaokao.xcodeproj \
  -scheme ios-gaokao \
  -configuration Staging \
  AISTUDY_API_BASE_URL_STAGING="$AISTUDY_API_BASE_URL_STAGING" \
  AISTUDY_DEVELOPMENT_TEAM="$AISTUDY_DEVELOPMENT_TEAM" \
  build
```

正式部署地址不写入仓库，建议通过 Xcode User-Defined Settings、CI
Variables 或 CI Secrets 注入。归档、导出和 TestFlight 上传命令见
`ios-gaokao/Config/README.md`。

## 公式与几何渲染（Science AST V1 公式 M1 已完成，iOS CI 全绿）

数学/理科公式与几何图形的原生渲染方案，详见 [docs/RENDER_AST.md](../../docs/RENDER_AST.md)。

**核心思路**：不依赖 Markdown `$$` 定界符，公式作为 AST 节点（`ContentBlock.formula(latex:)`），由 `FormulaView`（底层 iosMath）渲染；几何采用 Geometry AST + Swift `Canvas`/`Shape` 动态渲染，不依赖图 URL / TikZ。

| 里程碑 | 范围 | 状态 |
|--------|------|------|
| **M1 公式**（Science AST V1） | 后端 `answer`/`analysis`/`examPoints`/`feedback`/`summary` 升级为 `Block[]`（B 策略：模型只出 blocks，后端 `blocksToPlainText` 派生 string，零迁移）；前端 `ContentBlock` + `FormulaView`（`MathBackend` 协议：UnicodeMathBackend 阶段一 + IosMathBackend 阶段二）+ `MarkdownRenderer(blocks:)` 升级；iosMath 集成 | 实施完成（iOS CI 全绿，2026-08-09） |
| **M2 几何**（Science AST V2，核心） | Geometry AST schema（严格判别联合）+ `GeometryCanvasView` + 各节点 drawer + `geometry` task eval 8/8 + analyze 后置 attach（`visual(kind:"geometry")` block） | 核心完成（2026-08-09）；扩展见 [docs/GEOMETRY_V2_EXTENSIONS.md](../../docs/GEOMETRY_V2_EXTENSIONS.md) |

> **三版本说明**：M1/M2 分别属于 Science AST V1/V2；V3（知识图谱 / 学习智能）为长期积累型、未启动（见 [docs/SCIENCE_AST_IOS_ROADMAP.md](../../docs/SCIENCE_AST_IOS_ROADMAP.md)）。

**当前进度**：
- [x] 设计文档 `docs/RENDER_AST.md`
- [x] 后端 `schemas.ts` blockSchema + `blocks.ts` `blocksToPlainText` + `actions.ts` 派生回填 + `format.ts`/`tasks.ts` 分块输出
- [x] ApiContracts `ContentBlock.swift` + `AnalyzeModels.swift`/`GradeModels.swift` `*Blocks` 字段 + `ContentBlockTests.swift`
- [x] `FormulaView.swift`（`MathBackend` 协议 + `UnicodeMathBackend` 纯 Swift 降级跑通管线 + `IosMathBackend` 阶段二）
- [x] `MarkdownRenderer(blocks:)` 升级
- [x] `AnalysisResultView` / `GradeResultView` 接入（blocks 优先、回退 string-as-text-block）
- [x] iosMath SPM 集成（`kostub/iosMath from:2.5.0`，`project.yml` xcodeVersion 16.2，`ios-ci.yml` Xcode 路径同步；预期 1–3 轮 CI 试错）

> 渲染方式：**方式一** —— iosMath 管公式排版，SwiftUI 管壳与交互，不用 WebView 全包。
> iosMath：仓库 **`kostub/iosMath`**（非 `costism`，后者 404），MIT，自 2.0.0 起原生 SPM，`swift-tools 6.0` / `.iOS(.v13)`，Pin `from: "2.5.0"`（≥2.3.1，含 #215/#217 修复）。
