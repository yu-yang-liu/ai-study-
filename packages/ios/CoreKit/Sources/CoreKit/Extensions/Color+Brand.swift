import SwiftUI

// MARK: - Hex 颜色初始化

public extension Color {
    /// 将十六进制字符串（3/6/8 位）转换为 sRGB `Color`。
    /// - 支持形如 `"fff"`、`"ffffff"`、`"ffffffff"` 的输入，前导 `#` 自动忽略。
    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r, g, b: UInt64
        switch hex.count {
        case 3:
            (r, g, b) = ((int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (r, g, b) = (int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF)
        default:
            (r, g, b) = (0, 0, 0)
        }
        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: 1.0
        )
    }
}

// MARK: - 品牌色（明亮活泼 · 学习风）

public extension Color {
    /// 品牌主色 — 靛蓝（indigo-600, #4f46e5）。
    /// 白字对比 ≈ 8.5:1，过 WCAG AA；用于英雄卡底、头像、导航栏、进度条等。
    static let brandPrimary = Color(hex: "4f46e5")

    /// 品牌辅色 — 暖橙（orange-500, #f97316）。
    /// 与靛蓝互补，呼应"活泼"基调；用于轻量强调（选中态圈、图标点缀）。
    static let brandAccent = Color(hex: "f97316")

    /// 语义色 — 成功（green-500, #22c55e）。
    static let semanticSuccess = Color(hex: "22c55e")

    /// 语义色 — 警告/离线（amber-500, #f59e0b）。
    static let semanticWarning = Color(hex: "f59e0b")

    /// 语义色 — 信息/缓存（blue-500, #3b82f6）。
    static let semanticInfo = Color(hex: "3b82f6")
}

// MARK: - 品牌渐变

public extension LinearGradient {
    /// 品牌渐变 — 靛蓝 → 紫罗兰（indigo-600 #4f46e5 → violet-500 #8b5cf6）。
    /// 用于英雄卡、头像、BrandMark 等需要"明亮学习风"质感的场景。
    static let brandGradient = LinearGradient(
        colors: [Color(hex: "4f46e5"), Color(hex: "8b5cf6")],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )
}

// MARK: - 学科主题色

/// 学科主题色映射。
/// rawValue 严格对齐 `ApiContracts.Subject.rawValue`（语文/数学/…/地理），
/// 便于按学科名取色；未知学科名返回 nil，调用方应兜底到 `Color.brandPrimary`。
public enum SubjectTheme: String, Sendable, CaseIterable {
    case chinese = "语文"
    case math = "数学"
    case english = "英语"
    case physics = "物理"
    case chemistry = "化学"
    case biology = "生物"
    case politics = "政治"
    case history = "历史"
    case geography = "地理"

    /// 按学科名构造，未知返回 nil。
    public init?(subjectName: String) {
        self.init(rawValue: subjectName)
    }

    /// 该学科对应的主题色。
    public var color: Color {
        switch self {
        case .chinese: return Color(hex: "ef4444")     // 红
        case .math: return Color(hex: "3b82f6")         // 蓝
        case .english: return Color(hex: "8b5cf6")      // 紫罗兰
        case .physics: return Color(hex: "6366f1")      // 靛
        case .chemistry: return Color(hex: "10b981")    // 翠绿
        case .biology: return Color(hex: "14b8a6")      // 青绿
        case .politics: return Color(hex: "f59e0b")     // 琥珀
        case .history: return Color(hex: "a16207")      // 深黄（tinted-bg 可读）
        case .geography: return Color(hex: "0ea5e9")    // 天蓝
        }
    }
}
