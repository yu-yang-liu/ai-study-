import Foundation

// MARK: - Upload Response

/// POST /api/upload 响应体（服务端直传兼容）
public struct UploadResponse: Codable, Sendable {
    public let url: String
    public let key: String

    public init(url: String, key: String) {
        self.url = url
        self.key = key
    }
}

/// POST /api/upload/presign 请求体
public struct PresignUploadRequest: Codable, Sendable {
    public let contentType: String

    public init(contentType: String) {
        self.contentType = contentType
    }
}

/// POST /api/upload/presign 响应体
public struct PresignUploadResponse: Codable, Sendable {
    public let uploadUrl: String
    public let key: String
    public let url: String
}
