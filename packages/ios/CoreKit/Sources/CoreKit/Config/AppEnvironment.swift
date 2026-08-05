import Foundation

/// 应用环境配置（仅高中端）
public enum AppEnvironment: Sendable {
    public static let phase = "high"

    public static var baseURL: URL {
        guard let urlString = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
              let url = URL(string: urlString) else {
            return URL(string: "https://api.example.com")!
        }
        return url
    }

    public static var appName: String { "AI高中助手" }

    public static var keychainServiceName: String { "com.aistudy.app" }
}
