import Foundation

// MARK: - Login

/// POST /api/auth/login 请求体
/// 对应后端 zod schema: z.object({ email: z.string().email(), password: z.string().min(1) })
public struct LoginRequest: Codable, Sendable {
    public let email: String
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

/// POST /api/auth/login 成功响应
public struct LoginResponse: Codable, Sendable {
    public let user: UserInfo?
    public let session: SessionInfo?
}

// MARK: - Register

/// POST /api/auth/register 请求体
/// 对应后端 zod schema: z.object({ email: z.string().email(), password: z.string().min(8) })
public struct RegisterRequest: Codable, Sendable {
    public let email: String
    public let password: String

    public init(email: String, password: String) {
        self.email = email
        self.password = password
    }
}

/// POST /api/auth/register 成功响应
public struct RegisterResponse: Codable, Sendable {
    public let user: UserInfo?
    public let message: String
}

// MARK: - Logout

/// POST /api/auth/logout 响应
public struct LogoutResponse: Codable, Sendable {
    public let message: String
}

// MARK: - Token Refresh

/// POST /api/auth/refresh 请求体（Supabase refresh token）
public struct RefreshRequest: Codable, Sendable {
    public let refreshToken: String

    public init(refreshToken: String) {
        self.refreshToken = refreshToken
    }
}

/// POST /api/auth/refresh 响应
public struct RefreshResponse: Codable, Sendable {
    public let accessToken: String
    public let expiresAt: Int
    public let refreshToken: String?
}

// MARK: - Shared Auth Types

/// 用户基本信息
public struct UserInfo: Codable, Sendable, Equatable {
    public let id: String
    public let email: String
}

/// JWT 会话信息
public struct SessionInfo: Codable, Sendable {
    public let accessToken: String
    public let refreshToken: String?
    public let expiresAt: Int

    enum CodingKeys: String, CodingKey {
        case accessToken = "access_token"
        case refreshToken = "refresh_token"
        case expiresAt = "expires_at"
    }
}
