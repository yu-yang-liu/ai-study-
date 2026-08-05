import Foundation
import Security

/// Keychain 令牌存储封装
public actor TokenStorage: Sendable {
    private let serviceName: String
    private let accessTokenKey = "access_token"
    private let refreshTokenKey = "refresh_token"
    private let expiresAtKey = "expires_at"
    private let userIdKey = "user_id"
    private let userEmailKey = "user_email"

    public init(serviceName: String) {
        self.serviceName = serviceName
    }

    // MARK: - Save

    public func saveTokens(
        accessToken: String,
        refreshToken: String?,
        expiresAt: Int,
        userId: String? = nil,
        userEmail: String? = nil
    ) {
        save(key: accessTokenKey, value: accessToken)
        if let refresh = refreshToken {
            save(key: refreshTokenKey, value: refresh)
        }
        save(key: expiresAtKey, value: String(expiresAt))
        if let userId { save(key: userIdKey, value: userId) }
        if let userEmail { save(key: userEmailKey, value: userEmail) }
    }

    // MARK: - Read

    public func getAccessToken() -> String? {
        return read(key: accessTokenKey)
    }

    public func getRefreshToken() -> String? {
        return read(key: refreshTokenKey)
    }

    public func getExpiresAt() -> Int? {
        guard let value = read(key: expiresAtKey) else { return nil }
        return Int(value)
    }

    public func getUserId() -> String? {
        read(key: userIdKey)
    }

    public func getUserEmail() -> String? {
        read(key: userEmailKey)
    }

    /// Token 是否已过期（提前 60 秒判定）
    public func isTokenExpired() -> Bool {
        guard let expiresAt = getExpiresAt() else { return true }
        let now = Int(Date().timeIntervalSince1970)
        return now >= (expiresAt - 60)
    }

    // MARK: - Clear

    public func clearAll() {
        delete(key: accessTokenKey)
        delete(key: refreshTokenKey)
        delete(key: expiresAtKey)
        delete(key: userIdKey)
        delete(key: userEmailKey)
    }

    // MARK: - Keychain operations

    private func save(key: String, value: String) {
        delete(key: key) // 先删除旧值
        let data = value.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]
        SecItemAdd(query as CFDictionary, nil)
    }

    private func read(key: String) -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]
        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)
        guard status == errSecSuccess, let data = result as? Data else { return nil }
        return String(data: data, encoding: .utf8)
    }

    private func delete(key: String) {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: serviceName,
            kSecAttrAccount as String: key,
        ]
        SecItemDelete(query as CFDictionary)
    }
}
