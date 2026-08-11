import Foundation

/// App 专属配置（目录名 ios-gaokao 为历史遗留）
enum AppConfig {
    /// Bundle Identifier（与 AppEnvironment.keychainServiceName 前缀一致）
    static let bundleIdentifier = "com.aistudy.app"

    /// App 版本
    static let version = "1.0.0"
    static let buildNumber = "1"

    /// 最低支持 iOS 版本
    static let deploymentTarget = "17.0"
}
