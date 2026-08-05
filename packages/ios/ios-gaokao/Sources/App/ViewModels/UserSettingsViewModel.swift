import SwiftUI
import CoreKit

/// 用户设置页 ViewModel
@MainActor
final class UserSettingsViewModel: ObservableObject {
    @Published var nickname: String = "同学"
    @Published var examDate: Date = UserSettings.defaultExamDate
    @Published var targetScore: Double = 0
    @Published var notificationsEnabled: Bool = true
    @Published var gradeLevel: String = "高三"
    @Published var track: String = "未分科"
    @Published var themeMode: String = "system"
    @Published var isLoading = false
    @Published var saveSuccess = false
    @Published var errorMessage: String?

    private let dataRepository: DataRepository
    private let authManager: AuthManager
    private let notificationManager: NotificationManager

    /// 当前用户名（来自 AuthManager）
    var userEmail: String {
        authManager.currentUser?.email ?? ""
    }

    /// 当前昵称（已加载时返回 settings 昵称，否则用 userEmail）
    var displayName: String {
        nickname != "同学" ? nickname : (userEmail.isEmpty ? "同学" : String(userEmail.prefix(while: { $0 != "@" })))
    }

    init(
        dataRepository: DataRepository,
        authManager: AuthManager,
        notificationManager: NotificationManager
    ) {
        self.dataRepository = dataRepository
        self.authManager = authManager
        self.notificationManager = notificationManager
    }

    func loadSettings() async {
        isLoading = true
        let settings = await dataRepository.fetchOrCreateSettings()
        nickname = settings.nickname
        examDate = settings.examDate
        targetScore = settings.targetScore
        notificationsEnabled = settings.notificationsEnabled
        gradeLevel = settings.gradeLevel
        track = settings.track
        themeMode = settings.themeMode
        isLoading = false
    }

    func saveSettings() async {
        isLoading = true
        errorMessage = nil
        await dataRepository.updateSettings(
            nickname: nickname,
            examDate: examDate,
            targetScore: targetScore,
            notificationsEnabled: notificationsEnabled,
            gradeLevel: gradeLevel,
            track: track,
            themeMode: themeMode
        )
        // 同步通知授权
        if notificationsEnabled {
            let granted = await notificationManager.requestAuthorization()
            if granted {
                notificationManager.scheduleDailyReminder(hour: 19, minute: 0)
            }
        } else {
            notificationManager.cancelAllReminders()
        }
        saveSuccess = true
        isLoading = false
        // 短暂展示成功提示后清除
        try? await Task.sleep(nanoseconds: 2_000_000_000)
        saveSuccess = false
    }

    /// 各年级选项
    var gradeLevelOptions: [String] {
        #if GAOKAO
        return ["高一", "高二", "高三"]
        #else
        return ["初一", "初二", "初三"]
        #endif
    }

    /// 文理分科选项
    let trackOptions = ["未分科", "文科", "理科"]

    /// 主题选项
    let themeOptions: [(value: String, label: String, icon: String)] = [
        ("system", "跟随系统", "iphone"),
        ("light", "浅色模式", "sun.max.fill"),
        ("dark", "深色模式", "moon.fill")
    ]
}
