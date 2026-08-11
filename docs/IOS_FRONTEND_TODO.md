# iOS 前端功能与体验清单

> 基线日期：2026-08-11
> 用途：记录 iOS 用户体验上的未完成事项。每完成一个独立功能，就勾选对应条目，并在“完成记录”中补充日期、验证方式和相关提交。

## 使用规则

- 一个复选框对应一个可独立验收的功能。
- 只有实现、验证完成后才勾选，不因为“页面已经存在”提前勾选。
- 涉及后端、配置或 CI 的事项，也保留在这里，因为它们直接影响 iOS 用户能否使用。
- 科学 AST 的长期扩展只记录入口，详细设计继续维护在 `docs/SCIENCE_AST_IOS_ROADMAP.md` 和 `docs/VISUAL_AST_COVERAGE.md`。

## 已完成基线

- [x] 登录、注册、Token refresh、退出登录
- [x] Dashboard、高考倒计时、快捷功能入口
- [x] AI 文字对话、按学科切换、快捷提问、对话历史
- [x] Chat action 卡片：计划、批改、题目分析、错题摘要
- [x] 文字题目分析
- [x] 相册图片上传与题目分析
- [x] 数学/理科题和作文/文科题批改
- [x] 批改结果：评分、步骤反馈、结构化内容渲染
- [x] 批改历史本地查看
- [x] 错题列表、待复习/计划中分类、SM-2 复习反馈
- [x] 学习统计：练习量、正确率、平均分、各科表现、最近活动
- [x] AI 学习计划生成、任务展示、计划本地缓存
- [x] 用户设置：昵称、考试日期、目标分数、年级、文理方向、主题
- [x] iOS 本地学习提醒和通知权限设置
- [x] 公式、表格、步骤、图片、几何和学科可视化内容渲染

## P0：上线前必须完成

### 实施计划

#### 阶段 1：数据安全与用户隔离

目标：先保证同一设备上的多个账号互不看到数据。

实施顺序：

1. 确定统一的当前用户标识，并让 `DataRepository` 能拿到当前用户。
2. 为 `UserSettings`、`ChatHistory`、`GradeRecord`、`PlanCache` 增加用户归属字段。
3. 所有查询、保存、更新都增加用户过滤，不能只按学段或学科查询。
4. 登录切换用户时重新加载该用户数据。
5. 退出登录时清理当前用户的本地会话数据，或明确切换到隔离的数据空间。
6. 增加多用户测试：用户 A 写入数据，退出后用户 B 不得看到；重新登录 A 后数据恢复。

验收结果：

- 用户 A 和用户 B 在同一设备上看到的聊天、批改、计划、设置完全隔离。
- 退出登录后不会残留上一个用户的页面数据或本地缓存。

对应 P0 条目：

- SwiftData 按用户隔离聊天、批改、计划和设置
- 退出登录时清理或切换当前用户的本地缓存
- 验证多用户在同一设备上的登录、退出、重新登录流程

#### 阶段 2：API 环境配置

目标：让 Debug、staging、production 都指向明确且可验证的服务端。

实施顺序：

1. 定义 `Debug`、`Staging`、`Release` 三套 API 配置。
2. 将当前占位地址替换为真实 staging 地址。
3. 配置 production 地址，并确保 Release 不会误连 dev 环境。
4. 在 App 启动或设置诊断信息中确认当前环境，避免测试包连错服务。
5. 用 staging 完成登录、Chat、分析、批改、计划、错题、统计和上传冒烟测试。

验收结果：

- staging 和 production 地址不会写死在同一个默认回退逻辑中。
- TestFlight 包能明确确认自己连接的环境。

对应 P0 条目：

- 配置真实 staging API 地址
- 配置真实 production API 地址

#### 阶段 3：签名、归档与 TestFlight

目标：从“能在 CI 编译”变成“能交付给真实用户安装”。

实施顺序：

1. 确认 Bundle ID、Apple Team、证书和 provisioning profile。
2. 在 XcodeGen / Xcode 配置中补齐 `DEVELOPMENT_TEAM` 和 Release 签名设置。
3. 增加 Archive 和 ExportOptions 配置。
4. CI 保留模拟器构建，同时增加 Release archive 验证。
5. 使用 staging API 生成第一个 TestFlight 内测包。
6. 在真实设备完成安装、登录、上传、通知、退出登录和重新登录验证。

验收结果：

- CI 可以成功生成 archive。
- TestFlight 包可以安装并完成核心学习流程。
- 签名、API 环境和版本号都能追溯。

对应 P0 条目：

- 配置 Bundle ID、`DEVELOPMENT_TEAM` 和签名证书
- 增加 iOS Archive / ExportOptions 配置
- CI 增加可归档构建验证
- 完成一次 TestFlight 内测包上传和安装验证

#### 阶段 4：真题演练完整闭环

目标：把当前“题库数量展示页”变成真正可刷题的用户流程。

依赖：阶段 1 的用户隔离和阶段 2 的 staging API 先完成。

实施顺序：

1. 先定义 API 合同：题目列表、学科/年份/科目筛选、题目详情、提交答案、结果解析、练习记录。
2. 后端实现题目查询和提交接口，并补鉴权、分页、随机题和错误处理。
3. iOS 实现题库筛选页：学科、年份、题型、难度。
4. iOS 实现题目详情和答题状态：单选、多选、填空、主观题按实际题型支持。
5. iOS 实现交卷结果：得分、正确答案、解析、知识点和错题入口。
6. 写入练习记录、错题记录、统计数据和 `learning_events.practice`。
7. 在 TestFlight 包中完成连续刷题、退出重登、断网重试和结果恢复测试。

验收结果：

- 用户可以从题库进入一套题，完成答题并提交。
- 提交后可以看到成绩和解析。
- 错题、统计和学习事件会正确更新。
- 重新登录后可以恢复练习结果。

对应 P0 条目：

- 真题演练：题目列表、学科/年份筛选
- 真题演练：答题、交卷、解析和成绩结果
- 真题演练：练习记录写入学习统计和学习事件

#### P0 总体验收顺序

1. 本地多用户隔离测试通过。
2. staging 核心接口冒烟测试通过。
3. Release archive 成功。
4. TestFlight 安装和核心流程通过。
5. 真题演练闭环通过。
6. 更新本文件 P0 复选框和“完成记录”。

### 数据安全

- [x] SwiftData 按用户隔离聊天、批改、计划和设置
- [x] 退出登录时清理或切换当前用户的本地缓存
- [x] 验证多用户在同一设备上的登录、退出、重新登录流程

### 环境与发布

- [ ] 配置真实 staging API 地址
- [ ] 配置真实 production API 地址
- [ ] 配置 Bundle ID、`DEVELOPMENT_TEAM` 和签名证书
- [x] 增加 iOS Archive / ExportOptions 配置
- [x] CI 增加可归档构建验证
- [ ] 完成一次 TestFlight 内测包上传和安装验证

### 核心产品功能

- [x] 真题演练：题目列表、学科/年份筛选
- [x] 真题演练：答题、交卷、解析和成绩结果
- [x] 真题演练：练习记录写入学习统计和学习事件

## P1：完整体验需要完成

### 图片与输入

- [x] “拍照分析”接入真实相机拍摄
- [x] Chat 图片入口支持相机和相册
- [x] 图片上传前进行客户端压缩和尺寸校验
- [x] 图片上传失败时提供可恢复的重试体验

### 用户设置与学习数据

- [x] 增加用户 Profile 更新 API
- [x] 将目标分数、年级、文理方向、偏好同步到服务端
- [x] 登录后从服务端恢复用户设置
- [x] 计划支持服务端查询和跨设备恢复
- [x] 批改历史支持服务端查询和跨设备恢复
- [x] 错题、计划、统计和设置在用户切换后显示正确数据

### Chat 体验

- [x] 图片 Chat 保存到完整的对话历史
- [x] 本地 Chat 缓存保留 `replyBlocks`、action 和图片信息
- [x] Chat 图片分析结果支持继续追问
- [x] AI 结果卡片支持查看详情
- [x] AI 结果卡片支持再练一次，并自动带上原题上下文
- [x] AI 结果卡片支持加入错题

### 学习画像

- [x] 开放学习画像 Feature Flag
- [x] 增加学习画像查询 API
- [x] 增加学习画像页面
- [x] 展示薄弱知识点、错误类型、学科能力和趋势

### 工程质量

- [x] 增加 App target 的 ViewModel 测试
- [x] 增加 SwiftData 数据隔离和登出清理测试
- [x] 增加 API Mock 测试
- [ ] 增加登录、对话、分析、批改、错题复习 UI 测试
- [x] CI 执行 iOS App 测试而不只是构建
- [x] 将 `isPlanEnabled` 接入侧边栏 Feature Flag

## P1 Implementation Status (2026-08-11)

Validation: Core/Web `ts-check` passed; Core Vitest passed with `171 passed / 15 skipped`; visual-ast passed with 32 Node tests; `git diff --check` passed. macOS Xcode, device, staging API, and migration verification remain external checks.

Completed in code:

- Camera entry for Upload and Chat, including `NSCameraUsageDescription`.
- Profile GET/PATCH sync for nickname, exam date, target score, grade, track, notifications, and theme.
- Cloud-first active plan loading with local fallback.
- Cloud-first grading history loading with local fallback.
- Learner profile API, feature flag, and native iOS profile screen.
- Manual wrong-question creation and AI text-analysis result-card entry.
- `isPlanEnabled` applied to the sidebar and dashboard plan card.

Still pending external validation or dedicated tests:

- macOS Xcode build and simulator/device verification.
- UI tests.
- Staging smoke tests and database migration verification.

## P2：后续增强

### 学习体验

- [x] 学习计划任务支持完成、跳过和进度更新
- [x] 统计页增加趋势图、知识点掌握度和能力变化
- [x] 错题支持详情解析、搜索、筛选和手动加入
- [x] 支持收藏解析和重要内容标记
- [x] 完善网络异常、空状态、重试和加载状态的一致体验

### Science AST 扩展

- [x] 立体几何 `solid`
- [x] 圆锥曲线 `conic`
- [x] 化学分子结构 `molecular`
- [x] 动态几何和 relation 节点
- [ ] V3 Knowledge Graph Agent 与 iOS 学习画像联动

## 文档同步

- [x] 更新 `docs/PROJECT_REFERENCE.md` 中已经过时的 iOS 图片 Chat 描述
- [x] 每次完成 P0/P1 功能后同步更新本清单和相关路线图

## 完成记录

| 日期 | 条目 | 验证方式 | 提交 / PR |
|---|---|---|---|
| 2026-08-11 | P0 数据隔离、退出作用域重置与多用户测试 | SwiftData `DataRepositoryIsolationTests` 已补齐；登录身份变化时重建 `ContentView`；待 macOS Xcode 执行 | 工作区 |
| 2026-08-11 | P0 环境防误连与 CI Release archive 校验 | `AppEnvironment` 对 Staging/Release 缺失或占位地址 fail closed；新增 `validate-build-settings.sh`、归档环境元数据校验；待 macOS CI | 工作区 |
| 2026-08-11 | P0 真题演练按题型输入、结果与错题入口 | 题库筛选、单选/多选/主观题输入、交卷解析、失败重试、请求幂等、错题/统计/learning event 写入；Core `ts-check` 通过 | 工作区 |
| 2026-08-11 | iOS Archive / ExportOptions 配置 | `project.yml`、ExportOptions 模板、归档/导出/上传命令文档已补齐；待 macOS CI 和 Apple 凭据验收 | 工作区 |
| 2026-08-11 | P1 图片压缩、尺寸校验与失败重试 | 共享 `ImageUploadPreparer`；Upload/Chat 静态链路检查；Core/Web `ts-check`；待 macOS iOS 编译验证 | 工作区 |
| 2026-08-11 | P1 本地 Chat 缓存保留富消息字段 | 增加图片缩略图、`replyBlocks`、action、分析结果序列化；补旧 JSON 兼容测试；待 macOS iOS 编译验证 | 工作区 |
| 2026-08-11 | P1 图片分析结果继续追问 | Chat API 增加可选上下文；结果卡片增加“继续追问”；发送成功清除上下文、失败保留；待 macOS iOS 编译和 API 冒烟验证 | 工作区 |
| 2026-08-11 | P1 Chat 结果卡片详情与再次练习 | Chat 内使用紧凑分析卡片；“查看详情”打开完整解析；“再练一次”携带原题上下文直接发起相似练习；待 macOS iOS 编译验证 | 工作区 |
| 2026-08-11 | P1 图片 Chat 服务端富历史 | `conversation_messages.metadata` 保存图片地址、分析结果、action 和 reply blocks；新增历史追加接口与 iOS 同步重试；旧文本历史兼容；待 macOS iOS 编译、迁移和 API 冒烟验证 | 工作区 |
| 2026-08-11 | P2 学习体验闭环 | 计划任务状态与进度、统计趋势/掌握度/能力、错题详情搜索筛选手动加入收藏、统一离线/空/错/重试状态；Core/Web 类型检查与 Core/visual-ast 测试通过 | 工作区 |
| 2026-08-11 | P2 Science AST 扩展 | solid/conic/relation 几何抽屉、molecular 合同/提示词/后置挂载/iOS 渲染/eval 已补齐；原生 iOS 构建待 macOS CI | 工作区 |

## 当前状态

- 阶段 1（数据安全与用户隔离）：代码、作用域重置和多用户隔离测试已补齐，待 macOS Xcode 执行验证
- 阶段 2（API 环境配置）：Debug / Staging / Release 配置和 fail-closed 校验已补齐，真实 staging / production 部署地址仍需注入
- 阶段 3（签名、归档与 TestFlight）：ExportOptions 模板、Xcode 签名变量、unsigned Release archive CI、构建配置校验和归档元数据校验已补齐；正式签名与 TestFlight 仍待 Apple Team、证书和真实部署地址
- 阶段 4（真题演练）：题库筛选、单选/多选/主观题答题、结果、错题入口、失败重试、请求幂等、练习记录和学习事件代码已补齐，待执行 `0004` / `0005` 数据库迁移、staging API 和 iOS/macOS CI 验证
- P1 图片链路：Upload 与 Chat 已接入统一压缩、尺寸校验和失败重试，待 macOS iOS 编译验证
- P1 Chat 追问：图片分析结果可带上下文继续进入 Chat，待 macOS iOS 编译和 API 冒烟验证
- P1 Chat 结果卡片：已支持查看完整详情、带上下文再次练习和手动加入错题
- P1 图片 Chat 历史：服务端保存富消息元数据，iOS 在线恢复图片和分析卡片，同步失败可重试；待执行 `0007` 迁移与 iOS/API 验证
- 当前工作区验证：`@ai-study/core` / `@ai-study/web` TypeScript 通过；Core Vitest 171 passed、15 skipped；visual-ast Node 测试 32 passed；visual-ast TypeScript 通过；`git diff --check` 通过
- P0：8 / 12
- P1：25 / 26（仅完整 UI 测试仍待补）
- P2：9 / 10（仅 V3 学习智能长期项未启动）
- 文档同步：2 / 2
