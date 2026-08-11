import SwiftUI
import CoreKit
import ApiContracts

struct PlanView: View {
    @StateObject var viewModel: PlanViewModel

    var body: some View {
        VStack(spacing: 0) {
            if viewModel.showCachedBanner {
                HStack(spacing: 6) {
                    Image(systemName: "clock.arrow.circlepath").font(.caption)
                    Text("显示的是本地缓存的计划").font(.caption)
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity)
                .padding(.vertical, 6).background(Color.semanticInfo)
            }
            if viewModel.isOffline {
                HStack(spacing: 6) {
                    Image(systemName: "wifi.slash").font(.caption)
                    Text("离线模式，显示最新可用计划").font(.caption)
                }
                .foregroundStyle(.white).frame(maxWidth: .infinity)
                .padding(.vertical, 6).background(Color.semanticWarning)
            }
            if let actionError = viewModel.actionError {
                HStack(spacing: 6) {
                    Image(systemName: "exclamationmark.triangle")
                    Text(actionError)
                        .font(.caption)
                    Spacer()
                }
                .foregroundStyle(.red)
                .padding(.horizontal)
                .padding(.vertical, 6)
            }
            inputSection
            Divider()
            resultSection
        }
        .navigationTitle("学习计划")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var inputSection: some View {
        VStack(spacing: 12) {
            HStack(spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("学科").font(.caption).foregroundStyle(.secondary)
                    Picker("学科", selection: $viewModel.selectedSubject) {
                        ForEach(viewModel.subjects, id: \.self) { s in Text(s).tag(s) }
                    }.pickerStyle(.menu)
                }
                Spacer()
            }
            VStack(alignment: .leading, spacing: 4) {
                Text("学习重点（可选）").font(.caption).foregroundStyle(.secondary)
                TextField("例如：三角函数、阅读理解...", text: $viewModel.focus).textFieldStyle(.roundedBorder)
            }
            Button {
                Task { await viewModel.generatePlan() }
            } label: {
                if viewModel.result.isLoading {
                    ProgressView().tint(.white)
                } else {
                    Text("生成学习计划")
                }
            }.buttonStyle(.borderedProminent).frame(maxWidth: .infinity)
        }.padding()
    }

    @ViewBuilder
    private var resultSection: some View {
        switch viewModel.result {
        case .idle:
            EmptyPlaceholderView(message: "选择学科，AI 将为你量身定制学习计划")
        case .loading:
            CenteredProgressView("正在生成计划...")
        case .loaded(let plan):
            planContentView(plan)
        case .empty:
            EmptyPlaceholderView(message: "暂无学习计划")
        case .error(let error):
            ErrorPlaceholderView(error: error) { Task { await viewModel.generatePlan() } }
        }
    }

    private func planContentView(_ plan: PlanResponse) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(plan.title).font(.title2).fontWeight(.bold)
                if !plan.description.isEmpty { MarkdownRenderer(plan.description) }
                Divider()
                Text("学习任务").font(.headline)
                if !plan.tasks.isEmpty {
                    PlanProgressBar(tasks: plan.tasks)
                }
                ForEach(plan.tasks) { task in
                    PlanTaskCard(
                        task: task,
                        isUpdating: viewModel.updatingTaskIDs.contains(task.id),
                        onStatusChange: { status in
                            Task { await viewModel.updateTask(task, status: status) }
                        }
                    )
                }
            }.padding()
        }
    }
}

struct PlanTaskCard: View {
    let task: PlanTask
    let isUpdating: Bool
    let onStatusChange: (String) -> Void
    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text(task.priority.rawValue).font(.caption).fontWeight(.medium)
                    .padding(.horizontal, 8).padding(.vertical, 2)
                    .background(priorityColor.opacity(0.15)).foregroundStyle(priorityColor)
                    .clipShape(Capsule())
                Spacer()
                HStack(spacing: 2) {
                    Image(systemName: "clock").font(.caption2)
                    Text("约 \(task.estimatedMinutes) 分钟").font(.caption)
                }.foregroundStyle(.secondary)
            }
            Text(task.title).font(.headline)
            if !task.knowledgePoints.isEmpty {
                Text(task.knowledgePoints.joined(separator: " . ")).font(.caption).foregroundStyle(.secondary)
            }
            Text(task.reason).font(.subheadline).foregroundStyle(.secondary)
            HStack(spacing: 8) {
                if isUpdating {
                    ProgressView()
                } else {
                    Button(task.status == "completed" ? "鏀规垚寰呭畬鎴?" : "瀹屾垚") {
                        onStatusChange(task.status == "completed" ? "pending" : "completed")
                    }
                    .buttonStyle(.borderedProminent)

                    Button(task.status == "skipped" ? "鎭㈠" : "璺宠繃") {
                        onStatusChange(task.status == "skipped" ? "pending" : "skipped")
                    }
                    .buttonStyle(.bordered)
                }
                Spacer()
                Text(task.statusLabel)
                    .font(.caption)
                    .foregroundStyle(task.statusColor)
            }
        }.padding(12).background(Color(.systemGray6)).clipShape(RoundedRectangle(cornerRadius: 10))
    }
    private var priorityColor: Color {
        switch task.priority {
        case .high: return .red; case .medium: return .orange; case .low: return .green
        }
    }
}

private struct PlanProgressBar: View {
    let tasks: [PlanTask]

    private var completed: Int {
        tasks.filter { $0.status == "completed" }.count
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Text("完成进度")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Spacer()
                Text("\(completed)/\(tasks.count)")
                    .font(.caption)
                    .fontWeight(.semibold)
            }
            ProgressView(value: Double(completed), total: Double(max(tasks.count, 1)))
                .tint(Color.brandPrimary)
        }
    }
}

private extension PlanTask {
    var statusLabel: String {
        switch status {
        case "completed": return "已完成"
        case "skipped": return "已跳过"
        default: return "待完成"
        }
    }

    var statusColor: Color {
        switch status {
        case "completed": return .green
        case "skipped": return .orange
        default: return .secondary
        }
    }
}
