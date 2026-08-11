import SwiftUI
import CoreKit

/// 仪表盘页面：倒计时 + AI 学习计划 + 快捷工具网格
/// 工具卡片点击时通过回调触发侧边栏导航切换
struct DashboardView: View {
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.apiClient) var apiClient
    @Environment(\.dataRepository) var dataRepository

    let examDaysRemaining: Int
    let onToolSelected: (SidebarItem) -> Void

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                countdownCard
                assistantCTA
                if FeatureFlags.isPlanEnabled, let client = apiClient, let repo = dataRepository {
                    aiPlanCard(client: client, repo: repo)
                }
                quickToolsGrid
            }
            .padding()
            .padding(.bottom, 20)
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("仪表盘")
        .navigationBarTitleDisplayMode(.inline)
        .toolbarColorScheme(.dark, for: .navigationBar)
        .toolbarBackground(.visible, for: .navigationBar)
        .toolbarBackground(Color.brandPrimary, for: .navigationBar)
    }

    // MARK: - 倒计时卡片

    private var countdownCard: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("距离\(AppEnvironment.phase == "high" ? "高考" : "中考")还有")
                .font(.subheadline)
                .foregroundStyle(.white.opacity(0.7))

            HStack(alignment: .firstTextBaseline, spacing: 8) {
                Text("\(examDaysRemaining)")
                    .font(.system(size: 64, weight: .heavy, design: .rounded))
                    .foregroundStyle(.white)
                Text("天")
                    .font(.title2)
                    .fontWeight(.bold)
                    .foregroundStyle(.white.opacity(0.5))
            }

            Text("行百里者半九十，坚持就是胜利")
                .font(.caption)
                .foregroundStyle(.white.opacity(0.7))
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(LinearGradient.brandGradient)
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }

    // MARK: - AI 学习助手主入口

    private var assistantCTA: some View {
        Button {
            onToolSelected(.chat)
        } label: {
            VStack(alignment: .leading, spacing: 10) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(.white)
                    Text("AI \u{5b66}\u{4e60}\u{52a9}\u{624b}")
                        .font(.headline)
                        .foregroundStyle(.white)
                }
                Text("\u{61c2}\u{4f60}\u{7684}\u{5b66}\u{60c5}\u{ff0c}\u{53ef}\u{5236}\u{5b9a}\u{8ba1}\u{5212}\u{3001}\u{67e5}\u{9519}\u{9898}\u{3001}\u{6279}\u{6539}\u{4f5c}\u{4e1a}")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.9))
                Text("\u{5f00}\u{59cb}\u{5bf9}\u{8bdd}")
                    .fontWeight(.bold)
                    .foregroundStyle(Color.brandPrimary)
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
                    .background(.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
            }
            .padding(18)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(LinearGradient.brandGradient)
            .clipShape(RoundedRectangle(cornerRadius: 24))
        }
        .buttonStyle(.plain)
    }

    // MARK: - AI 学习计划卡片

    private func aiPlanCard(client: APIClient, repo: DataRepository) -> some View {
        Button {
            onToolSelected(.plan)
        } label: {
            VStack(alignment: .leading, spacing: 12) {
                HStack(spacing: 8) {
                    Image(systemName: "sparkles")
                        .foregroundStyle(Color.brandAccent)
                    Text("AI 定制提分计划")
                        .font(.headline)
                        .foregroundStyle(.primary)
                }

                Text("基于学情数据，AI 为你生成本日突破任务")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                HStack {
                    Text("点击生成")
                        .fontWeight(.bold)
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 12)
                        .background(Color.brandPrimary)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 24))
        }
        .buttonStyle(.plain)
    }

    // MARK: - 快捷工具 2x2 网格

    private var quickToolsGrid: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("智能备考工具")
                .font(.headline)
                .padding(.leading, 4)

            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                if FeatureFlags.isChatEnabled {
                    toolButton(.chat, icon: "text.bubble.fill", title: "AI \u{5b66}\u{4e60}\u{52a9}\u{624b}", subtitle: "\u{81ea}\u{7531}\u{4ea4}\u{6d41}\u{7b54}\u{7591}", color: Color.brandPrimary)
                }

                if FeatureFlags.isAnalyzeEnabled {
                    toolButton(.analyze, icon: "doc.text.magnifyingglass", title: "\u{9898}\u{76ee}\u{5206}\u{6790}", subtitle: "\u{6df1}\u{5ea6}\u{89e3}\u{6790}\u{9898}\u{5e72}", color: SubjectTheme.math.color)
                }

                if FeatureFlags.isImageUploadEnabled {
                    toolButton(.upload, icon: "camera.fill", title: "\u{62cd}\u{7167}\u{5206}\u{6790}", subtitle: "\u{4e0a}\u{4f20}\u{9898}\u{76ee}\u{56fe}\u{7247}", color: SubjectTheme.chemistry.color)
                }

                if FeatureFlags.isGradeEnabled {
                    toolButton(.grade, icon: "checkmark.circle.fill", title: "\u{4f5c}\u{4e1a}\u{6279}\u{6539}", subtitle: "\u{667a}\u{80fd}\u{8bc4}\u{5206}\u{53cd}\u{9988}", color: SubjectTheme.english.color)
                }

                if FeatureFlags.isWrongQuestionsEnabled {
                    toolButton(.wrongQuestions, icon: "xmark.circle.fill", title: "\u{9519}\u{9898}\u{590d}\u{4e60}", subtitle: "SM-2 \u{95f4}\u{9694}\u{590d}\u{4e60}", color: Color.semanticWarning)
                }

                if FeatureFlags.isStatsEnabled {
                    toolButton(.stats, icon: "chart.bar.fill", title: "\u{5b66}\u{4e60}\u{7edf}\u{8ba1}", subtitle: "\u{6570}\u{636e}\u{603b}\u{89c8}\u{5206}\u{6790}", color: SubjectTheme.physics.color)
                }

                toolButton(.realExam, icon: "book.pages.fill", title: "\u{771f}\u{9898}\u{6f14}\u{7ec3}", subtitle: "\u{8fd1}\u{5341}\u{5e74}\u{771f}\u{9898}\u{5e93}", color: SubjectTheme.geography.color)
            }
        }
    }

    private func toolButton(_ item: SidebarItem, icon: String, title: String, subtitle: String, color: Color) -> some View {
        Button { onToolSelected(item) } label: {
            ToolCard(icon: icon, title: title, subtitle: subtitle, color: color)
        }
        .buttonStyle(.plain)
    }
}

// MARK: - 工具卡片组件

struct ToolCard: View {
    let icon: String
    let title: String
    let subtitle: String
    let color: Color

    var body: some View {
        VStack(spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(color.opacity(0.12))
                    .frame(width: 52, height: 52)
                Image(systemName: icon)
                    .font(.title2)
                    .foregroundStyle(color)
            }

            Text(title)
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.primary)

            Text(subtitle)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity, minHeight: 130)
        .padding(.vertical, 12)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 24))
    }
}
