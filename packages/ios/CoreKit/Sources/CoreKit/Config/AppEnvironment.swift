import Foundation

/// 应用环境配置（仅高中端）
public enum AppEnvironment: Sendable {
    public enum APIEnvironment: String, Sendable {
        case development
        case staging
        case production
    }

    public static let phase = "high"

    public static var apiEnvironment: APIEnvironment {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "API_ENVIRONMENT") as? String else {
            #if DEBUG
            return .development
            #else
            fatalError("[AppEnvironment] API_ENVIRONMENT is missing")
            #endif
        }

        guard let environment = APIEnvironment(rawValue: rawValue.lowercased()) else {
            #if DEBUG
            return .development
            #else
            fatalError("[AppEnvironment] Unsupported API_ENVIRONMENT: \(rawValue)")
            #endif
        }
        return environment
    }

    public static var apiEnvironmentName: String {
        apiEnvironment.rawValue
    }

    public static var configuredBaseURLString: String? {
        guard let rawValue = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String else {
            return nil
        }
        let value = rawValue.trimmingCharacters(in: .whitespacesAndNewlines)
        return value.isEmpty ? nil : value
    }

    public static var baseURL: URL {
        guard let urlString = configuredBaseURLString,
              let url = URL(string: urlString),
              url.scheme?.lowercased() == "https",
              url.host != nil else {
            return invalidConfiguration("API_BASE_URL is missing or is not a valid HTTPS URL")
        }

        if apiEnvironment != .development && isPlaceholder(urlString) {
            return invalidConfiguration("API_BASE_URL is still a placeholder for \(apiEnvironmentName)")
        }

        return url
    }

    private static func isPlaceholder(_ value: String) -> Bool {
        let normalized = value.lowercased()
        return normalized.contains("$(")
            || normalized.contains("example.com")
            || normalized.contains("xxx.vercel.app")
    }

    private static func invalidConfiguration(_ message: String) -> URL {
        // Development previews may still boot without a local API. Staging and
        // production must fail closed so a misconfigured build never talks to dev.
        #if DEBUG
        if apiEnvironment == .development {
            print("[AppEnvironment] \(message); falling back to development URL")
            return URL(string: "https://api-dev.example.com")!
        }
        #endif
        fatalError("[AppEnvironment] \(message)")
    }

    public static var appName: String { "AI高中助手" }

    public static var keychainServiceName: String { "com.aistudy.app" }
}
