import SwiftUI
import CoreKit
import ApiContracts

struct LearnerProfileView: View {
    let apiClient: APIClient
    @State private var model: LearnerModel?
    @State private var errorMessage: String?
    @State private var isLoading = false

    var body: some View {
        Group {
            if isLoading && model == nil {
                CenteredProgressView("正在加载学习画像...")
            } else if let model {
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        richnessCard(model)
                        subjectSection(title: "薄弱学科", items: model.weakSubjects, color: .red)
                        subjectSection(title: "优势学科", items: model.strongSubjects, color: .green)
                        masterySection(model)
                        abilitySection(model)
                        errorSection(model)
                        paceSection(model)
                    }
                    .padding()
                }
            } else {
                ErrorPlaceholderView(
                    error: NSError(domain: "LearnerProfile", code: 1, userInfo: [
                        NSLocalizedDescriptionKey: errorMessage ?? "学习画像暂时不可用"
                    ])
                ) {
                    Task { await load() }
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("学习画像")
        .navigationBarTitleDisplayMode(.inline)
        .task { await load() }
        .refreshable { await load() }
    }

    private func load() async {
        guard !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            model = try await apiClient.fetchLearnerProfile()
            errorMessage = nil
        } catch {
            errorMessage = error.localizedDescription
        }
    }

    private func richnessCard(_ model: LearnerModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("学习数据成熟度").font(.headline)
                Spacer()
                Text("\(Int(model.dataRichness * 100))%")
                    .font(.headline)
                    .foregroundStyle(Color.brandPrimary)
            }
            ProgressView(value: model.dataRichness).tint(Color.brandPrimary)
            if let targetScore = model.targetScore {
                Text("目标分数 \(targetScore, specifier: "%.0f") 分")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func subjectSection(title: String, items: [String], color: Color) -> some View {
        if !items.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text(title).font(.headline)
                LazyVGrid(columns: [GridItem(.adaptive(minimum: 84), alignment: .leading)], alignment: .leading, spacing: 8) {
                    ForEach(items, id: \.self) { item in
                        Text(item)
                            .font(.caption)
                            .padding(.horizontal, 10)
                            .padding(.vertical, 6)
                            .background(color.opacity(0.12))
                            .foregroundStyle(color)
                            .clipShape(Capsule())
                    }
                }
            }
        }
    }

    private func masterySection(_ model: LearnerModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("知识点掌握度").font(.headline)
            if model.mastery.isEmpty {
                Text("完成更多练习后，这里会显示知识点趋势。")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(model.mastery.values.sorted { $0.level < $1.level }.prefix(8), id: \.knowledgePoint) { entry in
                    VStack(alignment: .leading, spacing: 5) {
                        HStack {
                            Text(entry.knowledgePoint).font(.subheadline)
                            Spacer()
                            Text("\(Int(entry.level * 100))%")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                        ProgressView(value: entry.level)
                            .tint(entry.level < 0.4 ? .red : entry.level < 0.7 ? .orange : .green)
                    }
                    .padding(.vertical, 4)
                }
            }
        }
    }

    private func abilitySection(_ model: LearnerModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("能力维度").font(.headline)
            ForEach(model.abilities.keys.sorted(), id: \.self) { key in
                HStack {
                    Text(key).font(.subheadline)
                    ProgressView(value: model.abilities[key] ?? 0).tint(Color.brandPrimary)
                    Text("\(Int((model.abilities[key] ?? 0) * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 38, alignment: .trailing)
                }
            }
        }
    }

    @ViewBuilder
    private func errorSection(_ model: LearnerModel) -> some View {
        if !model.errorProfile.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
                Text("常见错误类型").font(.headline)
                ForEach(model.errorProfile, id: \.type) { item in
                    HStack {
                        Text(item.type)
                        Spacer()
                        Text("\(item.count) 次")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                    }
                }
            }
        }
    }

    private func paceSection(_ model: LearnerModel) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("学习节奏").font(.headline)
            HStack(spacing: 12) {
                PaceMetric(title: "日均时长", value: "\(Int(model.pace.avgDailyMinutes)) 分钟")
                PaceMetric(title: "连续学习", value: "\(model.pace.streakDays) 天")
                PaceMetric(title: "活跃时段", value: model.pace.activeHours.isEmpty ? "暂无" : "\(model.pace.activeHours.count) 个")
            }
        }
    }
}

private struct PaceMetric: View {
    let title: String
    let value: String

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(.secondary)
            Text(value).font(.subheadline).fontWeight(.medium)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}
