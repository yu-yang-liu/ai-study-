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
