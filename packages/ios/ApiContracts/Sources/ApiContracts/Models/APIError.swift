import Foundation

/// 通用 API 错误响应，与后端 JSON  `{ error: "..." }`  结构对齐。
public struct APIErrorResponse: Codable, Sendable {
    public let error: String
}

/// 客户端统一错误类型
public enum ApiContractsError: Error, Sendable {
    case decodingFailed(String)
    case invalidResponse
}
