import SwiftUI
import CoreKit

// MARK: - 侧边栏导航项

enum SidebarItem: String, Identifiable, CaseIterable {
    case dashboard
    case chat
    case analyze
    case upload
    case grade
    case wrongQuestions
    case stats
    case plan
    case realExam

    var id: String { rawValue }

    var title: String {
        switch self {
        case .dashboard:       return "\u4eea\u8868\u76d8"
        case .chat:            return "AI \u5b66\u4e60\u52a9\u624b"
        case .analyze:         return "\u9898\u76ee\u5206\u6790"
        case .upload:          return "\u62cd\u7167\u5206\u6790"
        case .grade:           return "\u4f5c\u4e1a\u6279\u6539"
        case .wrongQuestions:  return "\u9519\u9898\u590d\u4e60"
        case .stats:           return "\u5b66\u4e60\u7edf\u8ba1"
        case .plan:            return "\u5b66\u4e60\u8ba1\u5212"
        case .realExam:        return "\u771f\u9898\u6f14\u7ec3"
        }
    }

    var icon: String {
        switch self {
        case .dashboard:       return "house.fill"
        case .chat:            return "text.bubble.fill"
        case .analyze:         return "doc.text.magnifyingglass"
        case .upload:          return "camera.fill"
        case .grade:           return "checkmark.circle.fill"
        case .wrongQuestions:  return "xmark.circle.fill"
        case .stats:           return "chart.bar.fill"
        case .plan:            return "sparkles"
        case .realExam:        return "book.pages.fill"
        }
    }

    /// 是否受 FeatureFlags 控制（不被控制则始终可见）
    var isFeatureFlagged: Bool {
        switch self {
        case .chat, .analyze, .grade, .upload, .wrongQuestions, .stats:
            return true
        default:
            return false
        }
    }

    /// 当前是否对该用户可见
    var isVisible: Bool {
        guard isFeatureFlagged else { return true }
        switch self {
        case .chat:           return FeatureFlags.isChatEnabled
        case .analyze:        return FeatureFlags.isAnalyzeEnabled
        case .grade:          return FeatureFlags.isGradeEnabled
        case .upload:         return FeatureFlags.isImageUploadEnabled
        case .wrongQuestions: return FeatureFlags.isWrongQuestionsEnabled
        case .stats:          return FeatureFlags.isStatsEnabled
        default:              return true
        }
    }
}

// MARK: - 侧边栏视图

struct SidebarView: View {
    @Binding var selection: SidebarItem?
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dataRepository) var dataRepository
    @Environment(\.notificationManager) var notificationManager

    let examDaysRemaining: Int

    @State private var nickname: String = "同学"
    @State private var showingProfile = false

    var body: some View {
        List(selection: $selection) {
            // 顶部：品牌 + 倒计时
            Section {
                headerSection
            }

            // 导航菜单
            Section {
                ForEach(SidebarItem.allCases) { item in
                    if item.isVisible {
                        Label(item.title, systemImage: item.icon)
                            .tag(item)
                    }
                }
            } header: {
                Text("功能导航")
            }
        }
        .listStyle(.sidebar)
        .safeAreaInset(edge: .bottom) {
            bottomUserSection
        }
        .sheet(isPresented: $showingProfile) {
            NavigationStack {
                if let repo = dataRepository, let nm = notificationManager {
                    ProfileView(
                        viewModel: UserSettingsViewModel(
                            dataRepository: repo,
                            authManager: authManager,
                            notificationManager: nm
                        )
                    )
                }
            }
        }
        .task {
            await loadNickname()
        }
    }

    // MARK: - 顶部品牌区

    private var headerSection: some View {
        VStack(spacing: 8) {
            BrandMark(size: 56)
            Text(AppEnvironment.appName)
                .font(.headline)
                .fontWeight(.bold)
            if examDaysRemaining > 0 {
                Text("距考试 \(examDaysRemaining) 天")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 8)
    }

    // MARK: - 底部用户区

    private var bottomUserSection: some View {
        Button {
            showingProfile = true
        } label: {
            HStack(spacing: 10) {
                Circle()
                    .fill(Color.brandPrimary)
                    .frame(width: 32, height: 32)
                    .overlay {
                        Text(String(nickname.prefix(1)))
                            .font(.caption)
                            .fontWeight(.bold)
                            .foregroundStyle(.white)
                    }

                VStack(alignment: .leading, spacing: 2) {
                    Text(nickname)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .foregroundStyle(.primary)
                    Text(authManager.currentUser?.email ?? "")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }

                Spacer()

                Image(systemName: "gearshape")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 10)
            .background(.ultraThinMaterial)
        }
        .buttonStyle(.plain)
    }

    // MARK: - 加载昵称

    private func loadNickname() async {
        guard let repo = dataRepository else { return }
        let settings = await repo.fetchOrCreateSettings()
        nickname = settings.nickname
    }
}
