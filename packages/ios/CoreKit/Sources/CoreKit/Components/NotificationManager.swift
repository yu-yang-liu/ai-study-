import Foundation
import UserNotifications

/// 本地通知管理器
/// 负责权限申请、学习提醒调度、通知取消
@MainActor
public final class NotificationManager: NSObject, ObservableObject, Sendable {
    @Published public private(set) var isAuthorized = false

    private let center = UNUserNotificationCenter.current()

    public override init() {
        super.init()
        center.delegate = self
    }

    // MARK: - 权限

    public func requestAuthorization() async -> Bool {
        do {
            let granted = try await center.requestAuthorization(options: [.alert, .badge, .sound])
            isAuthorized = granted
            return granted
        } catch {
            return false
        }
    }

    /// 检查当前通知设置
    public func checkAuthorizationStatus() async {
        nonisolated(unsafe) let settings = await center.notificationSettings()
        isAuthorized = settings.authorizationStatus == .authorized
    }

    // MARK: - 学习提醒

    /// 调度每日学习提醒
    /// - Parameters:
    ///   - hour: 24小时制，如 19 表示晚上7点
    ///   - minute: 分钟，如 30
    ///   - identifier: 唯一标识，用于后续取消
    public func scheduleDailyReminder(
        hour: Int,
        minute: Int,
        title: String = "学习时间到！",
        body: String = "今天的 AI 学习任务在等你，保持进步！",
        identifier: String = "daily-study-reminder"
    ) {
        let content = UNMutableNotificationContent()
        content.title = title
        content.body = body
        content.sound = .default
        content.badge = 1

        var dateComponents = DateComponents()
        dateComponents.hour = hour
        dateComponents.minute = minute

        let trigger = UNCalendarNotificationTrigger(dateMatching: dateComponents, repeats: true)
        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)

        center.add(request) { error in
            if let error = error {
                #if DEBUG
                print("[NotificationManager] 提醒调度失败: \(error.localizedDescription)")
                #endif
            }
        }
    }

    /// 取消提醒
    public func cancelReminder(identifier: String = "daily-study-reminder") {
        center.removePendingNotificationRequests(withIdentifiers: [identifier])
    }

    /// 取消所有待处理通知
    public func cancelAllReminders() {
        center.removeAllPendingNotificationRequests()
    }

    /// 获取所有待处理通知（调试用）
    public func pendingReminders() async -> [UNNotificationRequest] {
        nonisolated(unsafe) let requests = await center.pendingNotificationRequests()
        return requests
    }
}

// MARK: - UNUserNotificationCenterDelegate

extension NotificationManager: UNUserNotificationCenterDelegate {
    public nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification,
        withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
    ) {
        // 前台也展示通知
        completionHandler([.banner, .sound, .badge])
    }

    public nonisolated func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse,
        withCompletionHandler completionHandler: @escaping () -> Void
    ) {
        completionHandler()
    }
}
