import Foundation
import ApiContracts

/// 认证管理器
/// 管理登录/注册/登出/Token 刷新流程，通过 APIClient 通信
@MainActor
public final class AuthManager: ObservableObject, Sendable {
    @Published public private(set) var currentUser: UserInfo?
    @Published public private(set) var isAuthenticated = false

    private let apiClient: APIClient
    private let tokenStorage: TokenStorage

    public init(apiClient: APIClient, tokenStorage: TokenStorage) {
        self.apiClient = apiClient
        self.tokenStorage = tokenStorage
    }

    // MARK: - Public API

    public func login(email: String, password: String) async throws {
        let request = LoginRequest(email: email, password: password)
        let response = try await apiClient.login(request)

        guard let session = response.session else {
            throw AuthError.loginFailed("服务端未返回会话")
        }

        await tokenStorage.saveTokens(
            accessToken: session.accessToken,
            refreshToken: session.refreshToken,
            expiresAt: session.expiresAt,
            userId: response.user?.id,
            userEmail: response.user?.email
        )

        currentUser = response.user
        isAuthenticated = true
    }

    public func register(email: String, password: String) async throws -> RegisterResponse {
        let request = RegisterRequest(email: email, password: password)
        let response = try await apiClient.register(request)
        // 注册成功不自动登录，等待邮箱验证
        return response
    }

    public func logout() async {
        do {
            try await apiClient.logout()
        } catch {
            // 登出即使网络失败也应清理本地状态
        }
        await performLogoutCleanup()
    }

    /// 401 响应后强制刷新 Token（不依赖本地过期判断）
    public func refreshAfterUnauthorized() async -> Bool {
        guard let refreshToken = await tokenStorage.getRefreshToken() else {
            await performLogoutCleanup()
            return false
        }

        do {
            let request = RefreshRequest(refreshToken: refreshToken)
            let response = try await apiClient.refreshToken(request)
            await tokenStorage.saveTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken ?? refreshToken,
                expiresAt: response.expiresAt,
                userId: currentUser?.id,
                userEmail: currentUser?.email
            )
            return true
        } catch {
            await performLogoutCleanup()
            return false
        }
    }

    /// 尝试刷新 Token。成功返回 true，失败清除状态返回 false。
    public func refreshTokenIfNeeded() async -> Bool {
        guard await tokenStorage.isTokenExpired() else { return true }

        guard let refreshToken = await tokenStorage.getRefreshToken() else {
            await performLogoutCleanup()
            return false
        }

        do {
            let request = RefreshRequest(refreshToken: refreshToken)
            let response = try await apiClient.refreshToken(request)
            await tokenStorage.saveTokens(
                accessToken: response.accessToken,
                refreshToken: response.refreshToken ?? refreshToken,
                expiresAt: response.expiresAt,
                userId: currentUser?.id,
                userEmail: currentUser?.email
            )
            return true
        } catch {
            await performLogoutCleanup()
            return false
        }
    }

    /// 尝试从 Keychain 恢复会话
    public func restoreSession() async {
        guard let token = await tokenStorage.getAccessToken(),
              !(await tokenStorage.isTokenExpired()) else {
            return
        }
        if let id = await tokenStorage.getUserId(),
           let email = await tokenStorage.getUserEmail() {
            currentUser = UserInfo(id: id, email: email)
        }
        isAuthenticated = true
    }

    // MARK: - Internal

    private func performLogoutCleanup() async {
        await tokenStorage.clearAll()
        currentUser = nil
        isAuthenticated = false
    }
}

public enum AuthError: Error, LocalizedError {
    case loginFailed(String)
    case registerFailed(String)

    public var errorDescription: String? {
        switch self {
        case .loginFailed(let msg): return "登录失败: \(msg)"
        case .registerFailed(let msg): return "注册失败: \(msg)"
        }
    }
}
