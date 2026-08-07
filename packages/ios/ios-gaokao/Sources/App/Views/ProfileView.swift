import SwiftUI
import CoreKit

/// 用户设置 / "我的" 页面
struct ProfileView: View {
    @StateObject var viewModel: UserSettingsViewModel
    @EnvironmentObject var authManager: AuthManager
    @Environment(\.dismiss) var dismiss

    var body: some View {
        Form {
            // MARK: - 个人信息
            Section {
                HStack(spacing: 16) {
                    avatarView
                    VStack(alignment: .leading, spacing: 4) {
                        TextField("昵称", text: $viewModel.nickname)
                            .font(.title3)
                            .fontWeight(.semibold)
                        Text(viewModel.userEmail)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
                .padding(.vertical, 4)
            } header: {
                Text("个人信息")
            }

            // MARK: - 考试日期
            Section {
                DatePicker(
                    "考试日期",
                    selection: $viewModel.examDate,
                    displayedComponents: [.date]
                )
                .datePickerStyle(.compact)

                HStack {
                    Text("倒计时")
                    Spacer()
                    Text("\(daysRemaining) 天")
                        .fontWeight(.bold)
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("考试信息")
            } footer: {
                Text("若考试年份已过，系统会在启动时提醒您更新")
            }

            // MARK: - 目标分数
            Section {
                HStack {
                    Text("目标分数")
                    Spacer()
                    TextField("0", value: $viewModel.targetScore, format: .number)
                        .keyboardType(.decimalPad)
                        .multilineTextAlignment(.trailing)
                        .frame(width: 80)
                    Text("分")
                        .foregroundStyle(.secondary)
                }
            } header: {
                Text("学习目标")
            }

            // MARK: - 学习偏好
            Section {
                Picker("当前年级", selection: $viewModel.gradeLevel) {
                    ForEach(viewModel.gradeLevelOptions, id: \.self) { grade in
                        Text(grade).tag(grade)
                    }
                }

                Picker("文理分科", selection: $viewModel.track) {
                    ForEach(viewModel.trackOptions, id: \.self) { option in
                        Text(option).tag(option)
                    }
                }
            } header: {
                Text("学习偏好")
            }

            // MARK: - 通知
            Section {
                Toggle("每日学习提醒", isOn: $viewModel.notificationsEnabled)
            } header: {
                Text("通知设置")
            } footer: {
                Text("开启后每天 19:00 提醒您完成学习任务")
            }

            // MARK: - 主题
            Section {
                themePicker
            } header: {
                Text("界面主题")
            }

            // MARK: - 学习画像（FeatureFlag 控制，未开启时占位）
            Section {
                learnerProfileEntry
            } header: {
                Text("学习画像")
            } footer: {
                Text(FeatureFlags.isLearnerProfileEnabled
                     ? "基于你的练习、错题与计划生成的学情快照"
                     : "该功能正在开发中，敬请期待")
            }

            // MARK: - 账户信息
            Section {
                LabeledContent("用户 ID", value: authManager.currentUser?.id ?? "未登录")
                LabeledContent("绑定邮箱", value: viewModel.userEmail)
            } header: {
                Text("账户信息")
            }

            // MARK: - 退出登录
            Section {
                Button(role: .destructive) {
                    Task {
                        await authManager.logout()
                    }
                } label: {
                    HStack {
                        Spacer()
                        Text("退出登录")
                        Spacer()
                    }
                }
            }
        }
        .navigationTitle("我的")
        .navigationBarTitleDisplayMode(.inline)
        .overlay(alignment: .top) {
            if viewModel.saveSuccess {
                saveSuccessBanner
            }
        }
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("保存") {
                    Task { await viewModel.saveSettings() }
                }
                .fontWeight(.semibold)
                .disabled(viewModel.isLoading)
            }
        }
        .task {
            await viewModel.loadSettings()
        }
    }

    // MARK: - 学习画像入口

    /// 受 FeatureFlags.isLearnerProfileEnabled 控制：
    /// - 开启：跳转学习画像（后续版本接入学情快照端点）
    /// - 未开启（当前默认）：展示「敬请期待」占位，不造数据
    private var learnerProfileEntry: some View {
        if FeatureFlags.isLearnerProfileEnabled {
            // 预留：后续接入学情快照端点后，此处导航到 LearnerProfileView
            NavigationLink {
                learnerProfilePlaceholder(label: "学习画像")
            } label: {
                Label("查看学习画像", systemImage: "chart.bar.doc.horizontal")
            }
        } else {
            Label("学习画像（敬请期待）", systemImage: "chart.bar.doc.horizontal")
                .foregroundStyle(.secondary)
        }
    }

    /// 学习画像占位视图（flag 未开启时统一兜底）
    private func learnerProfilePlaceholder(label: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "chart.bar.doc.horizontal")
                .font(.system(size: 48))
                .foregroundStyle(.secondary)
            Text("\(label)功能即将上线")
                .font(.headline)
            Text("我们正在基于你的练习、错题与计划数据生成个性化学情画像，敬请期待。")
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(.systemGroupedBackground))
        .navigationTitle(label)
        .navigationBarTitleDisplayMode(.inline)
    }

    // MARK: - 头像

    private var avatarView: some View {
        ZStack {
            Circle()
                .fill(Color.brandPrimary)
                .frame(width: 56, height: 56)
            Text(avatarInitial)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(.white)
        }
    }

    private var avatarInitial: String {
        let name = viewModel.nickname.isEmpty ? "同" : String(viewModel.nickname.prefix(1))
        return name
    }

    // MARK: - 倒计时

    private var daysRemaining: Int {
        let cal = Calendar.current
        let startOfToday = cal.startOfDay(for: Date())
        let startOfExam = cal.startOfDay(for: viewModel.examDate)
        let days = cal.dateComponents([.day], from: startOfToday, to: startOfExam).day ?? 0
        return max(days, 0)
    }

    // MARK: - 主题选择器

    private var themePicker: some View {
        HStack(spacing: 12) {
            ForEach(viewModel.themeOptions, id: \.value) { option in
                Button {
                    viewModel.themeMode = option.value
                } label: {
                    VStack(spacing: 8) {
                        Image(systemName: option.icon)
                            .font(.title3)
                            .frame(width: 44, height: 44)
                            .background(
                                viewModel.themeMode == option.value
                                    ? Color.brandAccent.opacity(0.15)
                                    : Color(.systemGray6)
                            )
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        viewModel.themeMode == option.value
                                            ? Color.brandAccent
                                            : .clear,
                                        lineWidth: 2
                                    )
                            )

                        Text(option.label)
                            .font(.caption2)
                            .foregroundStyle(
                                viewModel.themeMode == option.value
                                    ? Color.brandAccent
                                    : .secondary
                            )
                    }
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity)
            }
        }
        .padding(.vertical, 6)
    }

    // MARK: - 保存成功

    private var saveSuccessBanner: some View {
        HStack(spacing: 8) {
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
            Text("设置已保存")
                .font(.subheadline)
                .fontWeight(.medium)
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 10)
        .background(.regularMaterial)
        .clipShape(Capsule())
        .shadow(color: .black.opacity(0.1), radius: 8, y: 4)
        .padding(.top, 8)
        .transition(.move(edge: .top).combined(with: .opacity))
        .animation(.spring(response: 0.4, dampingFraction: 0.7), value: viewModel.saveSuccess)
    }
}

#Preview {
    NavigationStack {
        ProfileView(
            viewModel: UserSettingsViewModel(
                dataRepository: DataRepository(modelContainer: try! ModelContainer(for: UserSettings.self)),
                authManager: AuthManager(apiClient: APIClient(baseURL: URL(string: "https://example.com")!, tokenProvider: { nil }, onUnauthorized: { false }), tokenStorage: TokenStorage(serviceName: "preview")),
                notificationManager: NotificationManager()
            )
        )
    }
}
