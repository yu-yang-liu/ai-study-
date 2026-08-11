import Foundation
import SwiftData

/// 用户个性化设置 SwiftData 模型
/// 单例记录（通过固定 UUID 保证唯一性）
@Model
public final class UserSettings: @unchecked Sendable {
    /// 固定标识（单例）
    @Attribute(.unique) public var id: UUID

    /// Remote account identifier that owns this record.
    /// Optional to allow lightweight migration of pre-isolation records.
    public var userID: String?

    /// 用户昵称
    public var nickname: String

    /// 考试日期（用户可手动调整年月日）
    public var examDate: Date

    /// 目标分数（0 表示未设置）
    public var targetScore: Double

    /// 是否开启学习提醒推送
    public var notificationsEnabled: Bool

    /// 当前年级（高一/高二/高三 或 初一/初二/初三）
    public var gradeLevel: String

    /// 文理分科（文科/理科/未分科）
    public var track: String

    /// 界面主题（system/light/dark）
    public var themeMode: String

    /// 上次检查的学年（如 "2025-2026"，用于智能年份更新）
    public var lastAcademicYearChecked: String

    /// 最后修改时间
    public var updatedAt: Date

    /// Legacy singleton ID retained for migration compatibility.
    public static let singletonID = UUID(uuidString: "00000000-0000-0000-0000-000000000001")!

    public init(
        id: UUID = UUID(),
        userID: String? = nil,
        nickname: String = "同学",
        examDate: Date = UserSettings.defaultExamDate,
        targetScore: Double = 0,
        notificationsEnabled: Bool = true,
        gradeLevel: String = "高三",
        track: String = "未分科",
        themeMode: String = "system",
        lastAcademicYearChecked: String = "",
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userID = userID
        self.nickname = nickname
        self.examDate = examDate
        self.targetScore = targetScore
        self.notificationsEnabled = notificationsEnabled
        self.gradeLevel = gradeLevel
        self.track = track
        self.themeMode = themeMode
        self.lastAcademicYearChecked = lastAcademicYearChecked
        self.updatedAt = updatedAt
    }

    // MARK: - 默认考试日期

    /// 根据当前日期推算默认考试日期
    /// - 若当前日期在当前学年考试日之前 → 取当前年份
    /// - 若当前日期已过考试日 → 取下一年
    public static var defaultExamDate: Date {
        let today = Date()
        let cal = Calendar.current
        let thisYear = cal.component(.year, from: today)

        return examDate(forYear: thisYear, calendar: cal, today: today)
    }

    /// 计算指定年份的考试日期，若已过期则自动推到下一年
    public static func examDate(forYear year: Int, calendar: Calendar = .current, today: Date = Date()) -> Date {
        let (examMonth, examDay) = defaultMonthDay
        var components = DateComponents(year: year, month: examMonth, day: examDay, hour: 9, minute: 0)
        guard let date = calendar.date(from: components) else {
            return Date().addingTimeInterval(365 * 24 * 60 * 60)
        }
        if date < today {
            return examDate(forYear: year + 1, calendar: calendar, today: today)
        }
        return date
    }

    /// 各学段的默认考试月日
    public static var defaultMonthDay: (month: Int, day: Int) {
        #if GAOKAO
        return (6, 7)   // 高考 6月7日
        #else
        return (6, 15)  // 中考 6月15日
        #endif
    }

    // MARK: - 智能学年检测

    /// 当前学年（如 2025年9月 → "2025-2026"）
    public static var currentAcademicYear: String {
        let cal = Calendar.current
        let year = cal.component(.year, from: Date())
        let month = cal.component(.month, from: Date())
        if month >= 9 {
            return "\(year)-\(year + 1)"
        } else {
            return "\(year - 1)-\(year)"
        }
    }

    /// 检测考试年份是否需要更新
    public func needsExamYearUpdate() -> Bool {
        let today = Date()
        if today > examDate && lastAcademicYearChecked != Self.currentAcademicYear {
            return true
        }
        return false
    }

    /// 自动将考试日期更新到当前学年
    public func autoAdvanceExamYear() {
        let cal = Calendar.current
        let thisYear = cal.component(.year, from: Date())
        let newDate = Self.examDate(forYear: thisYear)
        // SwiftData mutation must go through properties
        examDate = newDate
        lastAcademicYearChecked = Self.currentAcademicYear
        updatedAt = Date()
    }

    /// 倒计时天数（距 examDate 剩余天数）
    public var daysRemaining: Int {
        let cal = Calendar.current
        let startOfToday = cal.startOfDay(for: Date())
        let startOfExam = cal.startOfDay(for: examDate)
        let days = cal.dateComponents([.day], from: startOfToday, to: startOfExam).day ?? 0
        return max(days, 0)
    }
}
