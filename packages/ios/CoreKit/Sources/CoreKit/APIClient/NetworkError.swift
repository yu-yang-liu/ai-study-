import Foundation

/// 网络层错误类型
public enum NetworkError: Error, Sendable, LocalizedError {
    case invalidURL(String)
    case requestFailed(statusCode: Int, message: String)
    case decodingFailed(String)
    case unauthorized
    case rateLimited(retryAfter: TimeInterval?)
    case networkUnavailable
    case timeout
    case unknown(Error)

    public var errorDescription: String? {
        switch self {
        case .invalidURL(let url):
            return "无效的请求地址: \(url)"
        case .requestFailed(let code, let message):
            return "请求失败 (\(code)): \(message)"
        case .decodingFailed(let detail):
            return "数据解析失败: \(detail)"
        case .unauthorized:
            return "登录已过期，请重新登录"
        case .rateLimited(let retryAfter):
            if let seconds = retryAfter {
                return "请求过于频繁，请在 \(Int(ceil(seconds))) 秒后重试"
            }
            return "请求过于频繁，请稍后再试"
        case .networkUnavailable:
            return "网络连接不可用，请检查网络设置"
        case .timeout:
            return "请求超时，请检查网络后重试"
        case .unknown(let err):
            return "操作失败，请稍后再试"
        }
    }
}
