import SwiftUI
import CoreKit
import ApiContracts

struct StatsView: View {
    @StateObject var viewModel: StatsViewModel

    var body: some View {
        LoadingStateView(
            state: viewModel.stats,
            emptyMessage: "\u6682\u65e0\u5b66\u4e60\u6570\u636e\uff0c\u5b8c\u6210\u7ec3\u4e60\u540e\u4f1a\u5728\u6b64\u663e\u793a",
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
        .navigationTitle("\u5b66\u4e60\u7edf\u8ba1")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private func summaryCards(_ data: StatsResponse) -> some View {
        HStack(spacing: 12) {
            StatCard(value: "\(data.totalQuestions)", label: "\u603b\u7ec3\u4e60\u91cf")
            StatCard(value: "\(data.accuracy)%", label: "\u6b63\u786e\u7387")
            StatCard(value: "\(data.avgScore)", label: "\u5747\u5206")
        }
    }

    private func subjectSection(_ data: StatsResponse) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("\u5404\u79d1\u8868\u73b0")
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
            Text("\u6700\u8fd1\u5b66\u4e60")
                .font(.headline)

            VStack(spacing: 8) {
                ForEach(data.recentActivity.prefix(7)) { day in
                    HStack {
                        Text(day.date)
                            .foregroundStyle(.secondary)
                        Spacer()
                        Text("\(day.count) \u6b21")
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
