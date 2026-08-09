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
                if let client = apiClient, let repo = dataRepository {
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
                    Text("AI \u5b66\u4e60\u52a9\u624b")
                        .font(.headline)
                        .foregroundStyle(.white)
                }
                Text("\u61c2\u4f60\u7684\u5b66\u60c5\uff0c\u53ef\u5236\u5b9a\u8ba1\u5212\u3001\u67e5\u9519\u9898\u3001\u6279\u6539\u4f5c\u4e1a")
                    .font(.caption)
                    .foregroundStyle(.white.opacity(0.9))
                Text("\u5f00\u59cb\u5bf9\u8bdd")
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
                    toolButton(.chat, icon: "text.bubble.fill", title: "AI \u5b66\u4e60\u52a9\u624b", subtitle: "\u81ea\u7531\u4ea4\u6d41\u7b54\u7591", color: Color.brandPrimary)
                }

                if FeatureFlags.isAnalyzeEnabled {
                    toolButton(.analyze, icon: "doc.text.magnifyingglass", title: "\u9898\u76ee\u5206\u6790", subtitle: "\u6df1\u5ea6\u89e3\u6790\u9898\u5e72", color: SubjectTheme.math.color)
                }

                if FeatureFlags.isImageUploadEnabled {
                    toolButton(.upload, icon: "camera.fill", title: "\u62cd\u7167\u5206\u6790", subtitle: "\u4e0a\u4f20\u9898\u76ee\u56fe\u7247", color: SubjectTheme.chemistry.color)
                }

                if FeatureFlags.isGradeEnabled {
                    toolButton(.grade, icon: "checkmark.circle.fill", title: "\u4f5c\u4e1a\u6279\u6539", subtitle: "\u667a\u80fd\u8bc4\u5206\u53cd\u9988", color: SubjectTheme.english.color)
                }

                if FeatureFlags.isWrongQuestionsEnabled {
                    toolButton(.wrongQuestions, icon: "xmark.circle.fill", title: "\u9519\u9898\u590d\u4e60", subtitle: "SM-2 \u95f4\u9694\u590d\u4e60", color: Color.semanticWarning)
                }

                if FeatureFlags.isStatsEnabled {
                    toolButton(.stats, icon: "chart.bar.fill", title: "\u5b66\u4e60\u7edf\u8ba1", subtitle: "\u6570\u636e\u603b\u89c8\u5206\u6790", color: SubjectTheme.physics.color)
                }

                toolButton(.realExam, icon: "book.pages.fill", title: "\u771f\u9898\u6f14\u7ec3", subtitle: "\u8fd1\u5341\u5e74\u771f\u9898\u5e93", color: SubjectTheme.geography.color)
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
