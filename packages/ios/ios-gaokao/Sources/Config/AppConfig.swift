import Foundation

/// App 专属配置（目录名 ios-gaokao 为历史遗留）
enum AppConfig {
    /// Bundle Identifier（与 AppEnvironment.keychainServiceName 前缀一致）
    static let bundleIdentifier = "com.aistudy.app"

    /// App 版本
    static let version = "1.0.0"
    static let buildNumber = "1"

    /// 服务端 API 地址（生产环境占位）。
    ///
    /// ⚠️ 死常量：此处仅为文档展示，**未被任何运行时路径引用**。
    /// 实际运行时地址以 `AppEnvironment.baseURL`（CoreKit）为准——它从
    /// `Info.plist` 的 `API_BASE_URL`（由 `project.yml` build setting 注入）读取，
    /// 仅在缺失时才回退到 `https://api.example.com`。
    /// 因此真实部署只需改 `project.yml` 的 `API_BASE_URL`，无需改本常量。
    static let apiBaseURL = "https://api.example.com"

    /// 最低支持 iOS 版本
    static let deploymentTarget = "17.0"
}
