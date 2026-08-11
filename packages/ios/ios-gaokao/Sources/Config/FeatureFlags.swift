import Foundation

/// 功能开关 — 统一控制未完成功能的入口显隐
///
/// 用法：
/// ```
/// if FeatureFlags.isChatEnabled {
///     NavigationLink { ChatView(...) } label: { ... }
/// }
/// ```
///
/// 在 Release 配置中，所有未完成功能自动隐藏。
/// Debug 配置中可通过 scheme 环境变量覆盖。
public enum FeatureFlags: Sendable {
    /// AI 对话功能
    public static let isChatEnabled: Bool = { check("CHAT_ENABLED", default: true) }()

    /// 题目分析功能
    public static let isAnalyzeEnabled: Bool = { check("ANALYZE_ENABLED", default: true) }()

    /// 作业批改功能
    public static let isGradeEnabled: Bool = { check("GRADE_ENABLED", default: true) }()

    /// 学习计划功能
    public static let isPlanEnabled: Bool = { check("PLAN_ENABLED", default: true) }()

    /// 图片上传/OCR 功能
    public static let isImageUploadEnabled: Bool = { check("IMAGE_UPLOAD_ENABLED", default: true) }()

    /// 错题复习
    public static let isWrongQuestionsEnabled: Bool = { check("WRONG_QUESTIONS_ENABLED", default: true) }()

    /// 学习统计
    public static let isStatsEnabled: Bool = { check("STATS_ENABLED", default: true) }()

    /// 推送通知功能
    public static let isPushEnabled: Bool = { check("PUSH_ENABLED", default: true) }()

    /// 学习画像功能（后续版本）
    public static let isLearnerProfileEnabled: Bool = { check("LEARNER_PROFILE_ENABLED", default: true) }()

    // MARK: - 检查逻辑

    private static func check(_ key: String, default defaultValue: Bool) -> Bool {
        #if DEBUG
        // Debug 下可通过 ProcessInfo 环境变量覆盖
        if let envValue = ProcessInfo.processInfo.environment["FF_\(key)"] {
            return envValue == "1" || envValue.lowercased() == "true"
        }
        #endif
        return defaultValue
    }
}
