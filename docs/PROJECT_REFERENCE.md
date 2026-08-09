# ai-study 项目参考文档

> 本文档为项目的**领导性参考文档**，汇总定位、架构、状态、外部依赖、使用形式与待补逻辑。  
> 基线：**单学段（高中）** monorepo，包名 `@ai-study/*`，中考端 `ios-zhongkao` 已移除。

---

## 1. 项目概览

### 1.1 平台定位

面向高中学习场景的 AI 学习平台，采用 **pnpm monorepo** 架构，目标提供 **iOS 与 Android 原生客户端**及 Web 端，支持试卷解析、智能识别、AI 辅助批改、错题管理、学习计划、学习数据分析与智能对话等核心学习功能。

> **多端现状**：iOS（`packages/ios`）已实现；**Android（`packages/android`）开发中，与 iOS 功能对齐**。Web（`apps/web`）同时承担前端与 API 后端。

`packages` 体系承载平台共享能力，包括 AI 能力编排、多模型服务接入、知识检索增强（RAG）、学习算法（SM2 间隔重复）、智能 Agent（含 Agent Memory）、数据访问抽象、API 契约与通用业务逻辑，实现核心能力模块化管理与跨端复用。

后端采用云端服务架构（Supabase + 多 AI provider），通过统一能力调度层（`packages/core/src/ai`）连接 AI 模型与业务服务，实现模型调用、任务编排、用户数据管理与学习流程闭环。系统具备类型安全（TypeScript 全量 `tsc --noEmit`）、自动化测试（Vitest）与持续集成（GitHub Actions iOS/Web 双 CI），保障平台稳定性与工程质量。

### 1.2 关键事实

| 项 | 说明 |
|----|------|
| 名称 | `ai-study` |
| 定位 | AI 驱动的高中学习助手（分析、批改、**AI 学习助手**、计划、错题复习） |
| Web | `apps/web` — Next.js 15 App Router，`@ai-study/web`（前端 + API 路由） |
| Core | `packages/core` — 共享 TS 库，`@ai-study/core` |
| iOS | `packages/ios` — Swift 客户端，App 目录名保留 `ios-gaokao` |
| Android | `packages/android` — Kotlin + Jetpack Compose 客户端（`:apicontracts`/`:corekit`/`:app` 三层），开发中，与 iOS 功能对齐 |
| 学段 | `APP_PHASE = 'high'`（`packages/core/src/constants.ts`） |
| 学科 | `HIGH_SUBJECTS` 九科统一常量（语文…地理） |

### 仓库结构

```
ai-study/
├── apps/web/                 # Next.js Web + API 路由
├── packages/core/            # AI、鉴权、DB Schema、UI 组件、Agent、Memory
├── packages/ios/
│   ├── ApiContracts/         # Swift API 模型
│   ├── CoreKit/              # 网络、认证、共享 UI
│   └── ios-gaokao/           # App Target（目录名历史遗留）
├── packages/android/         # Kotlin + Compose 客户端（独立 Gradle 工程，不纳入 pnpm）
│   ├── apicontracts/         # 纯 JVM 数据契约（@Serializable）
│   ├── corekit/              # OkHttp/Retrofit、Bearer+refresh、配置、品牌色
│   └── app/                  # Compose UI、ViewModel、Room 缓存
├── .github/workflows/        # ios-ci.yml、web-ci.yml、android-ci.yml
├── docs/                     # 本文档等
└── README.md
```

`pnpm-workspace.yaml` 仅包含 `apps/*` 与 `packages/core`；iOS 为独立 Xcode 工程，Android 为独立 Gradle 工程，二者均不纳入 pnpm workspace。

---

## 2. 对齐与重构背景

### 2.1 历史问题（对齐前）

- 包名混用 `@ai-learning/*` 与 `@ai-study/*`
- `node_modules` 残留坏链（`@ai-learning/gaokao`、`zhongkao`）
- `.github/ios-ci.yml` 仍构建已删的 `ios-zhongkao`
- `packages/core/src/constants.ts` 缺失导致编译失败
- API 限流 `checkRateLimit` 未 `await`，限流不生效
- 多处 UTF-8 中文损坏（`??`、乱码）
- Web API 与 DB Schema 字段不一致（如 `event_type` vs `type`）

### 2.2 四个「看起来没更新」的目录

| 目录 | 原因 |
|------|------|
| `packages/` | 只改了 `core`；`ios` 仅最小改动 |
| `node_modules/` | 安装产物，需 `pnpm install` 重装才同步 |
| `.github/` | 上次未纳入清理；后已修 iOS CI |

### 2.3 已完成的对齐工作

**第一轮（谨慎对齐）：**

- 恢复 `constants.ts`（`APP_PHASE = 'high'`）
- `apps/web` 包名 → `@ai-study/web`，依赖 → `@ai-study/core`
- 修复 `.github/workflows/ios-ci.yml`（去掉中考端）
- 更新 `packages/ios` README、注释、Bundle ID → `com.aistudy.app`
- 重装 `node_modules`，清除 `@ai-learning` 残留
- 修复 UTF-8、`await` 限流、`pnpm-workspace.yaml` 的 `allowBuilds`

**第二轮（强化对齐）：**

- Middleware：`requireAuth` 成功时返回 `.response`
- 错题/统计 API → `wrong_questions` + `questions` + `practice_records`
- 统计 API → `practice_records` / `wrong_questions` / `learning_events`
- 批改 API → 落库 `questions`、`practice_records`、`wrong_questions`、`learning_events`
- 首页题库数 → `/api/bank/count`（替代 admin 接口）
- `HIGH_SUBJECTS` 单一来源；修复 `SubjectPicker`、`format.ts`、`content.ts`、导航
- 导航加入 `/upload`
- 新增 `/api/auth/refresh`；iOS 路径对齐
- 根 `README.md`、`.github/workflows/web-ci.yml`

**第三轮（数据闭环 + TestFlight 前置）：**

- `getAuthUser` 同时支持 Cookie 与 Bearer
- 登录/refresh 全链路返回 `refresh_token`；iOS 401 后自动 refresh 重试
- analyze / chat / plan 持久化；`profiles` / `user_profiles` bootstrap
- `knowledge_mastery` 写入；错题 `correctAnswer` join；统计准确率修正
- S3 预签名上传；upload → `analyzeImg` 接通
- iOS 错题/统计/上传界面；题库 count 展示

**第四轮（Chat Agent 增强，2026-07-20）：**

- `runChatAgent`：多轮记忆 + 学情快照 + 轻量 JSON tool-calling
- `getAssistantContext`：聚合计划/错题/近期练习
- 会话读写：`getOrCreateConversation` / `loadConversationMessages` / `GET /api/chat/history`
- `learning/actions.ts`：analyze/grade/plan 可复用服务层
- Web/iOS Chat UI：快捷 chip、action 卡片、服务端历史同步
- iOS Dashboard「AI 学习助手」主 CTA；Web 首页 Chat 置顶

### 2.4 刻意保留（控风险）

- **不重命名** `ios-gaokao/`（避免 Xcode 路径断裂）
- **保留** `GAOKAO` 编译开关（单端下行为不变）
- **不删** DB `phase_type` 枚举中的 `middle`（需迁移才能安全移除）
- **不改造** S3 签名、不重命名 iOS 目录为 `ios`

---

## 3. 完善度评估

### 3.1 综合评分

| 维度 | 完善度 | 说明 |
|------|--------|------|
| Monorepo 对齐 | ~90% | 包名、单学段、CI 文档已对齐 |
| Core 共享库 | ~80% | AI/鉴权/Schema/Agent/Actions 较完整 |
| Web 应用 | ~70% | 功能齐全，Chat Agent 串联学情 |
| iOS 客户端 | ~75% | 与 Web API 基本对等，TestFlight 可演示 |
| 测试 | ~25% | Core 11 个测试文件（51/51 通过） |
| 文档/运维 | ~50% | 有 README、Web CI；仍缺部署指南 |
| **可演示** | **~75%** | Chat Agent + 批改闭环可完整演示 |
| **可上线** | **~45%** | 运营/题库/RAG 深度仍不足 |

### 3.2 Web 功能矩阵

| 功能 | UI | API | 数据 | 综合 |
|------|----|-----|------|------|
| **AI 学习助手** | ✅ | ✅ | ✅ 多轮+学情+工具 | ~85% |
| 文本试题分析 | ✅ | ✅ | ✅ 落库 | ~85% |
| 智能批改 | ✅ | ✅ | ✅ 完整落库 | ~80% |
| 学习计划 | ✅ | ✅ | ✅ 保存 | ~75% |
| 错题复习 | ✅ | ✅ | ✅ SM-2 | ~70% |
| 学习统计 | ✅ | ✅ | ⚠️ 基础统计 | ~55% |
| 拍照上传 | ✅ | ✅ | ✅ presign + analyzeImg | ~65% |
| 管理后台 | ❌ | ✅ | 占位种子 | ~40% |
| 真题演练 | ❌ | ❌ | — | 0% |

### 3.3 验证命令

```bash
pnpm install
cd packages/core && pnpm exec tsc --noEmit && pnpm exec vitest run   # 51/51
cd apps/web && pnpm exec tsc --noEmit
```

---

## 4. 外部依赖

### 4.1 必须（核心功能）

| 服务 | 用途 | 环境变量 |
|------|------|----------|
| [Supabase](https://supabase.com) | 登录、PostgreSQL、RLS | `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY`、`SUPABASE_SERVICE_ROLE_KEY` |
| DeepSeek API | 分析/批改/计划/对话/Agent | `DEEPSEEK_API_KEY` |
| Node 22 + pnpm 9 | 本地/构建 | — |
| 部署主机（上线） | 跑 Next.js | `NEXT_PUBLIC_APP_URL` |

数据库初始化（一次性）：在 Supabase SQL Editor 依次执行  
`packages/core/src/db/migrations/0000_initial.sql`（需 **pgvector** 扩展）、  
`0001_conversation_summaries.sql`（M2 摘要表）、  
`0002_user_memory_facts.sql`（M3/M5 跨会话事实表）、  
`0003_user_memories.sql`（M4/M6 用户经历向量表 + `match_user_memories` RPC）。

### 4.2 强烈建议

| 服务 | 用途 | 环境变量 |
|------|------|----------|
| 阿里云 DashScope | RAG embedding、视觉/OCR | `DASHSCOPE_API_KEY`、`DASHSCOPE_VISION_API_KEY` |
| PostgreSQL 直连 | Drizzle 迁移/排查 | `DATABASE_URL` |

### 4.3 按功能可选

| 功能 | 依赖 | 环境变量 |
|------|------|----------|
| 图片上传 | S3 兼容存储 | `S3_*` 五项 |
| 多实例限流 | Redis | `REDIS_URL` |
| 本地对话降级 | Ollama | `OLLAMA_HOST`、`OLLAMA_MODEL` |
| 管理接口 | 邮箱白名单 | `ADMIN_EMAILS` |

### 4.4 功能 → API 对照

```
登录/注册/刷新       →  Supabase Auth
文本分析             →  DeepSeek（executeAnalyze）
智能批改             →  DeepSeek + DashScope Embedding（RAG）
AI 学习助手          →  DeepSeek（runChatAgent，含二次合成）
  ├ 制定计划         →  executePlan
  ├ 分析题目         →  executeAnalyze
  ├ 批改作答         →  executeGrade
  └ 查错题摘要       →  fetchWrongQuestionSummary（纯 DB）
学习计划             →  DeepSeek（executePlan）
错题/统计/落库       →  Supabase DB（需 SERVICE_ROLE_KEY）
图片上传             →  S3 presign + PUT
拍照分析             →  DashScope Vision（analyzeImg）
对话历史             →  GET /api/chat/history
```

### 4.5 iOS 额外需要

- macOS + Xcode 16 + xcodegen
- Apple Developer 账号（TestFlight/上架）
- 已部署 Web 的 HTTPS 地址（`project.yml` 中 `API_BASE_URL`）
- iOS **不需要**单独配 AI Key，全部走 Web API

### 4.6 Android 额外需要

- JDK 17（Temurin）
- Android SDK（compileSdk 35 / minSdk 26 / targetSdk 35）
- Gradle 8.9（项目自带 wrapper；首次需生成 `gradle-wrapper.jar`，见 [packages/android/README.md](../packages/android/README.md)）
- 已部署 Web 的 HTTPS 地址（`app/build.gradle.kts` 的 `API_BASE_URL`，与 iOS `project.yml` 同址）
- Android **不需要**单独配 AI Key，全部走 Web API（与 iOS 一致）

---

## 5. 使用形式（用户怎么用）

### 5.1 入口

| 形态 | 说明 |
|------|------|
| **Web 浏览器** | 完整入口；邮箱+密码登录 |
| **iOS App** | 与 Web 共用 API；Dashboard 有「AI 学习助手」主 CTA |
| **无** | 微信小程序、离线、桌面独立应用 |

### 5.2 推荐使用路径（5–10 分钟）

**路径 A — Chat Agent 一条龙（推荐演示）：**

```
注册/登录
  → AI 学习助手（/chat）
  → 快捷 chip：「帮我制定今日学习计划」/「我有哪些待复习错题」
  → 自然语言追问 / 贴题批改
  → 查看 action 卡片（计划/批改/错题摘要）
```

**路径 B — 传统工具箱：**

```
注册/登录
  → 智能批改（贴题目+作答）
  → 错题复习（SM-2 自评）
  → AI 学习助手（追问不懂的点）
  → （可选）学习计划、学习统计
```

### 5.3 各功能使用形式

| 形式 | 路径 | 特点 |
|------|------|------|
| **H. AI 学习助手** | `/chat` | **主入口**；多轮记忆、学情注入、对话内调工具；action 卡片 |
| A. 贴题分析 | `/analyze` | 文本/图片 URL；落库 + mastery |
| B. 贴题批改 | `/grade` | 核心闭环；错题可进复习 |
| D. 生成计划 | `/plan` | 按学情生成并保存 |
| E. 错题复习 | `/wrong-questions` | SM-2；需先批改产生错题 |
| F. 学习数据 | `/stats` | 只读仪表盘 |
| G. 拍照上传 | `/upload` | presign → S3 → analyzeImg |

### 5.4 Chat Agent 能力（对话内）

| 工具 | 触发示例 | 行为 |
|------|----------|------|
| `generate_plan` | 「帮我制定数学计划」 | 生成计划、落库、返回计划卡片 |
| `summarize_wrong_questions` | 「我有哪些错题」 | 读 DB 摘要，零额外 LLM |
| `analyze_question` | 粘贴足够长的题目 | 调用 analyze 并落库 |
| `grade_submission` | 同时给题目+作答 | 调用 grade 并落库 |
| 纯聊天 | 学情/薄弱点问答 | 基于 `getAssistantContext` 快照回答 |

限制：Chat 内暂不支持直接发图 OCR（仍走 `/upload`）；一次用户消息 = 一次 AI 限流。

### 5.5 产品形态定位

- **现在是：** 以 AI 学习助手为核心的自学 App/Web，保留独立工具页
- **还不是：** 班级教学系统、完整刷题 App、家长/教师端、后台主动教练

---

## 6. 试运营与 TestFlight

### 6.1 关键认知

- **TestFlight ≠ 免部署**：iOS 仍是 API 客户端，后端至少要部署一次
- **不必买域名**：Vercel 免费 `xxx.vercel.app` 即可作 `API_BASE_URL`
- **不必两套代码**：一套 monorepo，Web 部署 + iOS 指向同一 API

### 6.2 三种试运营方式

| 方式 | 适合 | 需要 |
|------|------|------|
| A. 邀请制内测（浏览器） | 5–20 人 | Supabase + DeepSeek，本地或单机部署 |
| B. 云端 Staging | 20–100 人 | Vercel + Supabase + 环境变量 |
| C. TestFlight | 要「像 App」 | 上述 + Mac + 开发者账号 + 后端部署 |

### 6.3 TestFlight 最小路径

```
1. apps/web 部署到 Vercel → https://xxx.vercel.app
2. 配置 Supabase / DeepSeek 等环境变量
3. project.yml 中 API_BASE_URL 改为该地址
4. Mac：xcodegen → Archive → TestFlight 邀请
5. 演示：Dashboard → AI 学习助手 → 快捷 chip 全流程
```

### 6.4 试运营期间对外说法

**可以说：** AI 学习助手（懂学情、可制定计划/查错题/批改）、文本分析、批改闭环、对话历史、iOS TestFlight 内测  
**先别说：** 全面真题库、提分承诺、Chat 内拍照搜题、已正式上架

---

## 7. 仍缺的逻辑（优先级）

### P0 — 上线前建议处理

| # | 问题 | 影响 |
|---|------|------|
| 1 | **题库/RAG 内容偏薄** | 批改/analyze 的 RAG 参考常为空；需 seed + embedding |
| 2 | **部署/运维文档缺失** | 新环境上手成本高 |

### P1 — 体验与深度

| # | 问题 |
|---|------|
| 3 | Chat 内不支持图片 OCR（需走 upload 页） |
| 4 | 无 DeepSeek native `tool_calls`（当前 JSON 意图方案够用但可迭代） |
| 5 | 无后台主动推送教练 |
| 6 | `learning_events` 中 `practice` 类型尚无写入（待真题演练功能实现后接入） |
| 7 | 统计/dashboard 算法与可视化仍偏基础 |
| 8 | iOS `真题演练` 占位；`FeatureFlags.isLearnerProfileEnabled` 未接 |
| 10 | **公式/几何渲染**：`MarkdownRenderer` 无 LaTeX 解析，公式显示为源码；几何图形无原生渲染。方案见 [RENDER_AST.md](./RENDER_AST.md)（M1 公式实施完成，iOS CI 全绿 / M2 几何待启动） |

### P1 — Agent Memory 六项（已实现，详见 [AGENT_MEMORY.md](./AGENT_MEMORY.md)）

| # | 能力 | 现状 |
|---|------|------|
| M1 | 独立 `AgentMemory` 抽象/模块 | ✅ 已实现：`packages/core/src/ai/memory/` 编排层（`loadMemory` / `appendTurn`），on top of L1–L3 |
| M2 | 超长对话压缩/摘要（超 20 条） | ✅ 已实现：`memory/summary.ts` + `conversation_summaries` 表，同步懒触发（>30 条） |
| M3 | 跨会话记忆合成 | ✅ 已实现：`user_memory_facts` 表 + `loadUserFacts` 注入 longTerm |
| M4 | 向量 / Episodic Memory | ✅ 已实现：`user_memories` 向量表 + `storeUserMemory`/`match_user_memories` |
| M5 | Agent 主动写/改 memory 条目 | ✅ 已实现：`remember_fact` / `forget_fact` Agent 工具 + `upsertFact` 真实写入 |
| M6 | RAG 检索用户历史 | ✅ 已实现：`retrieveUserMemory` 语义召回，`loadMemory` 注入 episodic |

**已实现（勿重复建设）**：L1 对话 20 条 + L2 学情快照（`getAssistantContext`）+ L3 工具落库。见 AGENT_MEMORY.md §2。

### P2 — 技术债

| # | 问题 |
|---|------|
| 9 | DB `phase_type` 去掉 `middle`（需迁移） |
| 11 | Web 导航仍写「AI 对话」而非「AI 学习助手」 |

### 已解决（勿重复修）

- ~~iOS Bearer 鉴权~~、~~refresh_token~~、~~getLearnerContext RLS~~、~~analyze/chat/plan 不落库~~
- ~~upload OCR 假通~~、~~iOS 错题/统计/上传缺口~~、~~S3 预签名~~

---

## 8. 建议实施顺序

### 试运营 / TestFlight 演示（当前即可）

1. 部署 Web + 配环境变量
2. iOS `API_BASE_URL` 指向 staging
3. 演示 Chat Agent 主路径（计划 / 错题 / 批改）
4. 可选：先批改几题产生错题数据，再演示学情问答

### 下一迭代

1. 题库 seed + RAG 质量提升
2. Chat 内接 `imageUrl`（upload 后带回对话）
3. 部署指南 + 监控
4. DB `phase_type` 迁移（可选）
5. **公式/几何渲染**（见 [RENDER_AST.md](./RENDER_AST.md)）：M1 公式 AST + iosMath；M2 几何 AST + Canvas

### Agent Memory 迭代（见 [AGENT_MEMORY.md](./AGENT_MEMORY.md)）

1. **M1** `AgentMemory` 模块统一读写 ✅ 已实现
2. **M2** 对话超 20 条摘要压缩 ✅ 已实现
3. **M3–M5** 跨会话事实 + Agent 写 memory ✅ 已实现（共用 `user_memory_facts` 表）
4. **M4 + M6** 用户 episodic embedding + RAG ✅ 已实现（`user_memories` 表 + `retrieveUserMemory`，与题库 RAG 分离）

---

## 9. 关键文件索引

| 类别 | 路径 |
|------|------|
| **公式/几何渲染方案** | [docs/RENDER_AST.md](./RENDER_AST.md) |
| **Agent Memory 专项** | [docs/AGENT_MEMORY.md](./AGENT_MEMORY.md) |
| 环境变量模板 | `apps/web/.env.example` |
| DB 迁移 | `packages/core/src/db/migrations/0000_initial.sql`、`0001_conversation_summaries.sql`、`0002_user_memory_facts.sql`、`0003_user_memories.sql` |
| Schema | `packages/core/src/db/schema.ts` |
| 常量/学科 | `packages/core/src/constants.ts` |
| 鉴权 | `packages/core/src/auth/index.ts`、`apps/web/middleware.ts` |
| **Chat Agent** | `packages/core/src/ai/agent/runChatAgent.ts` |
| **Agent Memory（M1）** | `packages/core/src/ai/memory/memory.ts` |
| **对话摘要（M2）** | `packages/core/src/ai/memory/summary.ts` |
| **跨会话事实（M3/M5）** | `packages/core/src/ai/memory/facts.ts` |
| **用户经历向量（M4/M6）** | `packages/core/src/ai/memory/episodic.ts` |
| **学情快照** | `packages/core/src/learning/assistant-context.ts` |
| **可复用 Actions** | `packages/core/src/learning/actions.ts` |
| **会话读写** | `packages/core/src/learning/conversation.ts`、`learning/persist.ts` |
| AI 路由 | `apps/web/src/app/api/{analyze,grade,chat,chat/history,plan,upload,wrong-questions,stats}/route.ts` |
| Chat UI | `apps/web/src/app/chat/page.tsx` |
| 导航 | `packages/core/src/ui/shell.tsx` |
| iOS API | `packages/ios/CoreKit/Sources/CoreKit/APIClient/` |
| iOS Chat | `packages/ios/ios-gaokao/Sources/App/Views/ChatView.swift` |
| iOS Dashboard | `packages/ios/ios-gaokao/Sources/App/Views/DashboardView.swift` |
| iOS 配置 | `packages/ios/ios-gaokao/project.yml` |
| Android API 客户端 | `packages/android/corekit/src/main/kotlin/com/aistudy/corekit/net/ApiClient.kt` |
| Android 入口 | `packages/android/app/src/main/kotlin/com/aistudy/app/MainActivity.kt` |
| Android README | `packages/android/README.md` |
| CI | `.github/workflows/ios-ci.yml`、`web-ci.yml`、`android-ci.yml` |

### Chat Agent 数据流

```
POST /api/chat
  → loadMemory({ userId, subject, conversationId? })   // M1 统一读入口
       ├ getOrCreateConversation + loadConversationMessages(20)
       └ getAssistantContext（计划/错题/近7天练习快照，≤800 字）
  → runChatAgent（JSON 意图 → 工具执行 → 可选二次合成）
  → appendTurn（落 conversation_messages）
  → { reply, conversationId, action? }
```

---

## 10. 对话时间线摘要

| 阶段 | 用户意图 | 结论/行动 |
|------|----------|-----------|
| check | 检查项目状态 | tsc/vitest 通过；对齐工作正常 |
| 完善度 | 整体完成度 | 可演示 ~75%，可上线 ~45%；最大 gap 是数据闭环 |
| 强化对齐 | 修不一致与断裂 | 错题/统计/批改落库、middleware、编码、CI、README |
| 数据闭环 | P0/P1 批量修复 | 鉴权、持久化、mastery、iOS 功能对等、S3 |
| Chat Agent | 增强 AI 对话 | 多轮+学情+tool-calling；Web/iOS 主入口升级 |
| TestFlight | 能否免域名折腾 | 可以 TestFlight，但仍需部署后端；不必买域名 |

---

## 11. 待办

### 已完成

- [x] `getAuthUser` 支持 Bearer Token（TestFlight 前置）
- [x] 登录返回并存储 `refresh_token`
- [x] 接通 upload → `analyzeImg`（`imageUrl` 参数）
- [x] `getLearnerContext` 服务端用 `createServiceClient`
- [x] 修 login/chat/plan 文案与部分错误处理
- [x] analyze / chat / plan 持久化
- [x] 学情写入：`profiles` + `user_profiles` bootstrap（注册/登录）
- [x] `knowledge_mastery` 写入（analyze/grade/错题复习）
- [x] `question_bank` 导入管线（`ingestQuestionBankEntries` + `POST /api/admin/bank/ingest`）
- [x] iOS 错题/统计/上传界面
- [x] iOS `/api/bank/count` 题库数量展示（真题演练占位页）
- [x] iOS APIClient 401 后 refresh 并重试
- [x] 错题 `correctAnswer` join；统计准确率修正
- [x] grade 落库错误检查强化
- [x] S3 SigV4 / 预签名 URL（`createPresignedUploadUrl` + `POST /api/upload/presign`）
- [x] **Chat Agent**：`runChatAgent` + `getAssistantContext` + 工具层
- [x] **对话历史**：`GET /api/chat/history` + Web/iOS 同步
- [x] **Actions 抽取**：`executeAnalyze` / `executeGrade` / `executePlan`
- [x] **UI**：Chat 快捷 chip、action 卡片、Dashboard/Web 主 CTA
- [x] **Web 导航文案**：统一为「AI 学习助手」
- [x] **UTF-8 历史损坏修复**：`AIStructuredError` 信息、`structuredCall` 重试提示、`db/index.ts` 注释
- [x] **错误处理对齐**：`persist.ts` 各 insert 检查 error；grade/plan 路由补 `AIStructuredError → 422`；多处 `request.json()` 补 try/catch
- [x] **`/api/auth/refresh` 限流**：补 IP 维度限流
- [x] **代码评审整改（第三阶段）**：
  - service-role client 单例化（`getServiceClient`），anon client 仍按请求新建
  - `ChatAction` 改判别联合（`{ type; payload }`），移除 `as unknown as Record<string, unknown>`；删除 `runChatAgent` 冗余二次 `chatAgentOutput.parse`
  - grade 及格阈值常量化（`GRADE_PASS_RATIO = 0.6`）
  - `persistGradeResult` 迁入 `persist.ts`；stats / wrong-questions 路由查询下沉 `learning/queries.ts`；共享类型抽至 `learning/types.ts`
  - `getOrCreateConversationRow` 返回真实 `updated_at`（修正冷启动伪时间戳）
  - upload key 改用 `crypto.randomUUID()`；`assistant-context` 检索补 `limit(50)`
  - schema `userMemoryFacts/userMemories.phase` 由 `phaseEnum` 改 `text`，与迁移 0002/0003 对齐（零迁移）

### 未完成

- [ ] DB `phase_type` 去掉 `middle`（需迁移）
- [ ] 部署指南 / 运维文档
- [ ] 题库/RAG 大规模 seed
- [ ] Chat 内图片 OCR（v2）
- [x] **公式渲染 M1**：后端 `Block[]` schema + 前端 `FormulaView`(iosMath) + `MarkdownRenderer(blocks:)`（见 [RENDER_AST.md](./RENDER_AST.md)）
- [ ] **几何渲染 M2**：Geometry AST + `GeometryCanvasView`（提示词待补）

### Agent Memory 六项（[AGENT_MEMORY.md](./AGENT_MEMORY.md) §3）

- [x] **M1** 独立 `AgentMemory` 抽象/模块（`packages/core/src/ai/memory/`，编排层 on top of L1–L3）
- [x] **M2** 超长对话压缩/摘要（超 20 条）（`memory/summary.ts` + `conversation_summaries` 表）
- [x] **M3** 跨会话记忆合成（`memory/facts.ts` + `user_memory_facts` 表，注入 longTerm）
- [x] **M4** 向量 / Episodic Memory（`memory/episodic.ts` + `user_memories` 表，批改/计划/事实写入向量）
- [x] **M5** Agent 主动写/改 memory 条目（`remember_fact`/`forget_fact` 工具 + `upsertFact`）
- [x] **M6** RAG 检索用户历史（`retrieveUserMemory` 语义召回，注入 episodic，区别于 `question_bank`）

---

*文档版本：2026-08-06 · 对应当前工作区代码状态（M1–M6 全部已落地，第三阶段评审整改已完成：tsc 双包通过、vitest 74/74）*
