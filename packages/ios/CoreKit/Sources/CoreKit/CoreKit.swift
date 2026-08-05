import Foundation

/// CoreKit: AI 高中学习系统 iOS 客户端共享基础设施
///
/// 提供：
/// - APIClient: 统一网络层，30s 超时，自动 JWT 附加与 401 刷新
/// - AuthManager: 登录/注册/登出/Token 管理
/// - TokenStorage: Keychain 封装
/// - AppEnvironment: 单学段（高中）环境配置
/// - NetworkError: 用户可理解的错误消息
public enum CoreKit {
    public static let version = "0.1.0"
}
