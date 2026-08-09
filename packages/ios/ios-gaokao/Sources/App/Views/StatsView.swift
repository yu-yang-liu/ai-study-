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
