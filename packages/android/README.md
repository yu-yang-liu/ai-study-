# Android 客户端（AI高中助手）

Android 原生客户端，Kotlin + Jetpack Compose。镜像 iOS 三层架构（`ApiContracts` → `CoreKit` → `App`），纯 API 客户端，消费已部署的 Web API。**不纳入 pnpm workspace**，与 iOS 一样是独立 Gradle 工程。

## 模块结构

| 模块 | 对应 iOS | 职责 |
|------|----------|------|
| `:apicontracts` | `packages/ios/ApiContracts/` | 纯 JVM 库，`@Serializable` 数据契约（16 端点） |
| `:corekit` | `packages/ios/CoreKit/` | 网络（OkHttp/Retrofit）、鉴权（Bearer + refresh）、配置、品牌色 |
| `:app` | `packages/ios/ios-gaokao/` | Compose UI、ViewModel、Room 本地缓存 |

依赖方向：`app → corekit → apicontracts`。

## 环境要求

- JDK 17
- Android SDK（compileSdk 35，minSdk 26）
- Gradle 8.9（自带 wrapper）
- **不需要**单独配置 AI Key，全部走 Web API

> **首次准备 wrapper**：仓库提交了 `gradlew`/`gradlew.bat` 与 `gradle-wrapper.properties`，但 `gradle-wrapper.jar` 为二进制不入库。若本地无该 jar，在 `packages/android` 下执行：
> ```bash
> gradle wrapper --gradle-version 8.9 --distribution-type bin
> ```
> （需系统已装 Gradle；CI 通过 `gradle/actions/setup-gradle` 自动处理。）

## 构建

```bash
cd packages/android
./gradlew :app:assembleDebug      # 编译 debug APK
./gradlew :apicontracts:test      # apicontracts 单测
./gradlew :corekit:testDebug      # corekit 单测（401/429 拦截器）
./gradlew test                    # 全部单测
```

> `detekt` 插件仅在根 `build.gradle.kts` 声明 `apply false`，尚未在各模块配置 task；如需静态检查，先在模块 `build.gradle.kts` 启用 `id("io.gitlab.arturbosch.detekt")`。

## 配置 API 地址

`API_BASE_URL` 通过 BuildConfig 注入（`app/build.gradle.kts` 的 `buildTypes`）：
- `debug` → `https://api-dev.example.com`
- `release` → `https://api.example.com`

部署到 staging 时，把对应 buildType 的 `API_BASE_URL` 改为实际地址（与 iOS `project.yml` 改 `API_BASE_URL` 一致）。

## 与 iOS 的对应关系

- 数据模型：Swift `Codable` + `CodingKeys` → Kotlin `@Serializable` + `@SerialName`（snake_case 字段：`access_token`/`refresh_token`/`expires_at`/`sm2_interval`/`sm2_ease`/`content_type`）
- 鉴权：Keychain → `EncryptedSharedPreferences`；401 → OkHttp `Authenticator` 刷新重试一次
- 状态：`@Published` + `ObservableObject` → `StateFlow` + `ViewModel`
- 缓存：SwiftData → Room
- 导航：`NavigationSplitView` → `NavigationSuiteScaffold` + `NavHost`（9 目的地）
- 设置/登出：iOS `ProfileView` sheet → Android AppBar `AccountCircle` 入口 + `ModalBottomSheet` 承载 `ProfileScreen`
- Chat 渲染：iOS `MarkdownRenderer`（assistant）→ Android `compose-markdown`（仅 assistant）
- 下拉刷新：iOS `.refreshable` → Android Material3 `PullToRefreshBox`（Stats / WrongQuestions）
- 品牌色：`brandPrimary #0f172a` / `brandAccent #64748b` → `Color(0xFF0F172A)` / `Color(0xFF64748B)`
- 部署目标：iOS 17.0 → Android `minSdk 26`

详见根目录 `docs/PROJECT_REFERENCE.md` 与实施计划。
