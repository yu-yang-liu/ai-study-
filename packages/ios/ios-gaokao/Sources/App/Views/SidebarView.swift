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
        case .dashboard:       return "\u{4eea}\u{8868}\u{76d8}"
        case .chat:            return "AI \u{5b66}\u{4e60}\u{52a9}\u{624b}"
        case .analyze:         return "\u{9898}\u{76ee}\u{5206}\u{6790}"
        case .upload:          return "\u{62cd}\u{7167}\u{5206}\u{6790}"
        case .grade:           return "\u{4f5c}\u{4e1a}\u{6279}\u{6539}"
        case .wrongQuestions:  return "\u{9519}\u{9898}\u{590d}\u{4e60}"
        case .stats:           return "\u{5b66}\u{4e60}\u{7edf}\u{8ba1}"
        case .plan:            return "\u{5b66}\u{4e60}\u{8ba1}\u{5212}"
        case .realExam:        return "\u{771f}\u{9898}\u{6f14}\u{7ec3}"
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
