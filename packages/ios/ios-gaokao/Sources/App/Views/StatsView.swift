import SwiftUI
import CoreKit
import ApiContracts

struct StatsView: View {
    @StateObject var viewModel: StatsViewModel

    var body: some View {
        LoadingStateView(
            state: viewModel.stats,
            emptyMessage: "\u{6682}\u{65e0}\u{5b66}\u{4e60}\u{6570}\u{636e}\u{ff0c}\u{5b8c}\u{6210}\u{7ec3}\u{4e60}\u{540e}\u{4f1a}\u{5728}\u{6b64}\u{663e}\u{793a}",
            onRetry: { Task { await viewModel.load() } }
        ) { data in
            ScrollView {
                VStack(spacing: 20) {
                    summaryCards(data)
                    subjectSection(data)
                    if let trend = data.trend, !trend.isEmpty {
                        trendSection(trend)
                    }
                    if let mastery = data.mastery, !mastery.isEmpty {
                        masterySection(mastery)
                    }
                    if let abilities = data.abilities, !abilities.isEmpty {
                        abilitySection(abilities)
                    }
                    if !data.recentActivity.isEmpty {
                        recentSection(data)
                    }
                }
                .padding()
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("\u{5b66}\u{4e60}\u{7edf}\u{8ba1}")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private func summaryCards(_ data: StatsResponse) -> some View {
        HStack(spacing: 12) {
            StatCard(value: "\(data.totalQuestions)", label: "\u{603b}\u{7ec3}\u{4e60}\u{91cf}")
            StatCard(value: "\(data.accuracy)%", label: "\u{6b63}\u{786e}\u{7387}")
            StatCard(value: "\(data.avgScore)", label: "\u{5747}\u{5206}")
        }
    }

    private func subjectSection(_ data: StatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\u{5404}\u{79d1}\u{8868}\u{73b0}")
                .font(.headline)

            ForEach(viewModel.subjects, id: \.self) { subject in
                if let item = data.subjectBreakdown[subject] {
                    SubjectProgressRow(
                        subject: subject,
                        accuracy: viewModel.subjectAccuracy(item)
                    )
                }
            }
        }
    }

    private func recentSection(_ data: StatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\u{6700}\u{8fd1}\u{5b66}\u{4e60}")
                .font(.headline)

            VStack(spacing: 8) {
                ForEach(data.recentActivity.prefix(7)) { day in
                    HStack {
                        Text(day.date)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(day.count) \u{6b21}")
                            .fontWeight(.medium)
                    }
                    .font(.subheadline)
                }
            }
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func trendSection(_ trend: [StatsTrendItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("最近趋势")
                .font(.headline)
            VStack(alignment: .leading, spacing: 10) {
                Text("练习量与正确率")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                StatsTrendChart(items: trend)
                    .frame(height: 150)
                HStack {
                    Text("最近 \(trend.last?.count ?? 0) 次")
                    Spacer()
                    Text("正确率 \(trend.last?.accuracy ?? 0)%")
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }
            .padding()
            .background(.regularMaterial)
            .clipShape(RoundedRectangle(cornerRadius: 16))
        }
    }

    private func masterySection(_ mastery: [MasteryStatsItem]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("知识点掌握度")
                .font(.headline)
            ForEach(mastery.prefix(8)) { item in
                HStack(spacing: 10) {
                    Text(item.knowledgePoint)
                        .font(.subheadline)
                        .lineLimit(1)
                    GeometryReader { geo in
                        ZStack(alignment: .leading) {
                            Capsule().fill(Color(.systemGray5))
                            Capsule()
                                .fill(item.level >= 0.7 ? .green : .orange)
                                .frame(width: geo.size.width * item.level)
                        }
                    }
                    .frame(height: 8)
                    Text("\(Int(item.level * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 40, alignment: .trailing)
                }
            }
        }
    }

    private func abilitySection(_ abilities: [String: Double]) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("能力变化")
                .font(.headline)
            ForEach(abilities.keys.sorted(), id: \.self) { key in
                HStack {
                    Text(key)
                        .font(.subheadline)
                        .frame(width: 48, alignment: .leading)
                    ProgressView(value: abilities[key] ?? 0, total: 1)
                        .tint(Color.brandAccent)
                    Text("\(Int((abilities[key] ?? 0) * 100))%")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(width: 40, alignment: .trailing)
                }
            }
        }
    }
}

private struct StatsTrendChart: View {
    let items: [StatsTrendItem]

    var body: some View {
        GeometryReader { geometry in
            let width = geometry.size.width
            let height = geometry.size.height
            let maxCount = max(items.map(\.count).max() ?? 1, 1)
            Path { path in
                for (index, item) in items.enumerated() {
                    let x = items.count <= 1
                        ? width / 2
                        : width * CGFloat(index) / CGFloat(items.count - 1)
                    let y = height - (CGFloat(item.count) / CGFloat(maxCount)) * height
                    if index == 0 { path.move(to: CGPoint(x: x, y: y)) }
                    else { path.addLine(to: CGPoint(x: x, y: y)) }
                }
            }
            .stroke(Color.brandPrimary, style: StrokeStyle(lineWidth: 3, lineCap: .round, lineJoin: .round))
            .overlay {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    let x = items.count <= 1
                        ? width / 2
                        : width * CGFloat(index) / CGFloat(items.count - 1)
                    let y = height - (CGFloat(item.count) / CGFloat(maxCount)) * height
                    Circle()
                        .fill(Color.brandPrimary)
                        .frame(width: 7, height: 7)
                        .position(x: x, y: y)
                }
            }
        }
        .padding(.vertical, 8)
    }
}

private struct StatCard: View {
    let value: String
    let label: String

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

private struct SubjectProgressRow: View {
    let subject: String
    let accuracy: Int

    var body: some View {
        HStack(spacing: 12) {
            Text(subject)
                .font(.subheadline)
                .frame(width: 36, alignment: .leading)

            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color(.systemGray5))
                    Capsule()
                        .fill(Color.brandPrimary)
                        .frame(width: geo.size.width * CGFloat(accuracy) / 100)
                }
            }
            .frame(height: 8)

            Text("\(accuracy)%")
                .font(.caption)
                .foregroundStyle(.secondary)
                .frame(width: 36, alignment: .trailing)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    NavigationStack {
        StatsView(viewModel: StatsViewModel(apiClient: APIClient(
            baseURL: URL(string: "https://example.com")!,
            tokenProvider: { nil },
            onUnauthorized: { false }
        )))
    }
}
