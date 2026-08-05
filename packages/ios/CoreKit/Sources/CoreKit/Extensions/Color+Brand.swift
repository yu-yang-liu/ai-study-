import SwiftUI

// MARK: - Hex 颜色初始化

public extension Color {
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

// MARK: - 品牌色（高端极简 · slate 体系）

public extension Color {
    /// 品牌主色 — 深墨黑
    /// 高考/中考统一，极简化
    static let brandPrimary = Color(hex: "0f172a")

    /// 品牌辅色 — 冷静灰
    /// 仅用于轻量强调（选中态、渐变线的浅端）
    static let brandAccent = Color(hex: "64748b")
}
