import SwiftUI
import SwiftData
import CoreKit

struct APIClientKey: EnvironmentKey {
    static let defaultValue: APIClient? = nil
}

struct DataRepositoryKey: EnvironmentKey {
    static let defaultValue: DataRepository? = nil
}

struct NotificationManagerKey: EnvironmentKey {
    static let defaultValue: NotificationManager? = nil
}

struct NetworkMonitorKey: EnvironmentKey {
    static let defaultValue: NetworkMonitor? = nil
}

extension EnvironmentValues {
    var apiClient: APIClient? {
        get { self[APIClientKey.self] }
        set { self[APIClientKey.self] = newValue }
    }
    var dataRepository: DataRepository? {
        get { self[DataRepositoryKey.self] }
        set { self[DataRepositoryKey.self] = newValue }
    }
    var notificationManager: NotificationManager? {
        get { self[NotificationManagerKey.self] }
        set { self[NotificationManagerKey.self] = newValue }
    }
    var networkMonitor: NetworkMonitor? {
        get { self[NetworkMonitorKey.self] }
        set { self[NetworkMonitorKey.self] = newValue }
    }
}

@main
struct AILearningApp: App {
    @StateObject private var appCoordinator = AppCoordinator()
    var body: some Scene {
        WindowGroup {
            Group {
                if appCoordinator.isAuthenticated {
                    ContentView()
                        .environmentObject(appCoordinator.authManager)
                        .environment(\.apiClient, appCoordinator.apiClient)
                        .environment(\.dataRepository, appCoordinator.dataRepository)
                        .environment(\.notificationManager, appCoordinator.notificationManager)
                        .environment(\.networkMonitor, appCoordinator.networkMonitor)
                } else {
                    LoginView()
                        .environmentObject(appCoordinator.authManager)
                }
            }
            .onAppear {
                Task {
                    await appCoordinator.bootstrap()
                }
            }
        }
        .modelContainer(appCoordinator.modelContainer)
    }
}

@MainActor
final class AppCoordinator: ObservableObject {
    @Published var isAuthenticated = false
    let authManager: AuthManager
    let apiClient: APIClient
    let dataRepository: DataRepository
    let networkMonitor: NetworkMonitor
    let notificationManager: NotificationManager
    let modelContainer: ModelContainer
    private let tokenStorage: TokenStorage
    private var didBootstrap = false

    init() {
        let unauthorizedHandler = UnauthorizedHandler()
        do {
            modelContainer = try ModelContainer(for: ChatHistoryRecord.self, GradeRecord.self, PlanCache.self, UserSettings.self)
        } catch {
            fatalError("SwiftData init failed: \(error)")
        }
        tokenStorage = TokenStorage(serviceName: AppEnvironment.keychainServiceName)
        apiClient = APIClient(
            baseURL: AppEnvironment.baseURL,
            tokenProvider: { [tokenStorage] in await tokenStorage.getAccessToken() },
            onUnauthorized: { [unauthorizedHandler] in
                guard let coordinator = unauthorizedHandler.coordinator else { return false }
                return await coordinator.handleUnauthorized()
            }
        )
        authManager = AuthManager(apiClient: apiClient, tokenStorage: tokenStorage)
        dataRepository = DataRepository(modelContainer: modelContainer)
        networkMonitor = NetworkMonitor()
        notificationManager = NotificationManager()
        unauthorizedHandler.coordinator = self
        Task { @MainActor in
            for await authenticated in authManager.$isAuthenticated.values {
                if authenticated, let userID = authManager.currentUser?.id {
                    await self.dataRepository.setCurrentUserID(userID)
                } else {
                    await self.dataRepository.clearCurrentUser()
                }
                self.isAuthenticated = authenticated
            }
        }
    }

    func bootstrap() async {
        guard !didBootstrap else { return }
        didBootstrap = true

        await authManager.restoreSession()
        await syncRepositoryScope()
        await notificationManager.checkAuthorizationStatus()

        guard authManager.isAuthenticated else { return }
        await checkAndPromptExamYearUpdate(repo: dataRepository, auth: authManager)
    }

    private func syncRepositoryScope() async {
        if authManager.isAuthenticated, let userID = authManager.currentUser?.id {
            await dataRepository.setCurrentUserID(userID)
        } else {
            await dataRepository.clearCurrentUser()
        }
    }

    /// 401 未授权：尝试刷新 Token，失败则登出
    private func handleUnauthorized() async -> Bool {
        let refreshed = await authManager.refreshAfterUnauthorized()
        if !refreshed {
            isAuthenticated = false
        }
        return refreshed
    }
}

/// 401 处理器中转：避免 init 中构造 apiClient 时闭包提前捕获未初始化的 self
private final class UnauthorizedHandler: @unchecked Sendable {
    weak var coordinator: AppCoordinator?
}

// MARK: - 智能考试年份检测

/// 在 App 启动时检测，若考试日期已过且学年未更新，自动推进
private func checkAndPromptExamYearUpdate(repo: DataRepository, auth: AuthManager) async {
    let updated = await repo.autoAdvanceExamYearIfNeeded()
    if updated {
        // 用户下次打开设置页时可看到更新后的日期
        #if DEBUG
        print("[ExamYear] 考试年份已自动更新到当前学年")
        #endif
    }
}
