import SwiftUI
import CoreKit

// MARK: - 双栏主框架

struct ContentView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.apiClient) var apiClient
    @Environment(\.dataRepository) var dataRepository
    @Environment(\.notificationManager) var notificationManager

    @State private var selectedItem: SidebarItem? = .dashboard
    @State private var examDaysRemaining: Int = 0
    @State private var columnVisibility: NavigationSplitViewVisibility = .automatic

    var body: some View {
        NavigationSplitView(columnVisibility: $columnVisibility) {
            SidebarView(
                selection: $selectedItem,
                examDaysRemaining: examDaysRemaining
            )
            .environmentObject(authManager)
            .environment(\.dataRepository, dataRepository)
            .environment(\.notificationManager, notificationManager)
            .navigationSplitViewColumnWidth(min: 220, ideal: 260, max: 320)
        } detail: {
            detailView
                .id(selectedItem)
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        SidebarToggleButton(columnVisibility: $columnVisibility)
                    }
                }
        }
        .task {
            await loadCountdown()
        }
    }

    // MARK: - 详情路由

    @ViewBuilder
    private var detailView: some View {
        if let client = apiClient, let repo = dataRepository {
            switch selectedItem {
            case .dashboard:
                DashboardView(
                    examDaysRemaining: examDaysRemaining,
                    onToolSelected: { item in
                        selectedItem = item
                    }
                )
                .environmentObject(authManager)
                .environment(\.apiClient, client)
                .environment(\.dataRepository, repo)

            case .chat:
                ChatView(viewModel: ChatViewModel(apiClient: client, dataRepository: repo))

            case .analyze:
                AnalyzeView(viewModel: AnalyzeViewModel(apiClient: client))

            case .upload:
                UploadView(viewModel: UploadViewModel(apiClient: client))

            case .grade:
                GradeView(viewModel: GradeViewModel(apiClient: client, dataRepository: repo))

            case .wrongQuestions:
                WrongQuestionsView(viewModel: WrongQuestionsViewModel(apiClient: client))

            case .stats:
                StatsView(viewModel: StatsViewModel(apiClient: client))

            case .plan:
                PlanView(viewModel: PlanViewModel(apiClient: client, dataRepository: repo))

            case .realExam:
                RealExamPlaceholderView(apiClient: client)

            case nil:
                DashboardView(
                    examDaysRemaining: examDaysRemaining,
                    onToolSelected: { item in
                        selectedItem = item
                    }
                )
                .environmentObject(authManager)
                .environment(\.apiClient, client)
                .environment(\.dataRepository, repo)
            }
        }
    }

    // MARK: - 加载倒计时

    private func loadCountdown() async {
        guard let repo = dataRepository else { return }
        let settings = await repo.fetchOrCreateSettings()
        examDaysRemaining = settings.daysRemaining
    }
}

#Preview {
    ContentView()
}
