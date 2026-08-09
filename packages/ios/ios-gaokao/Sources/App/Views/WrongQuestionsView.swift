import SwiftUI
import CoreKit
import ApiContracts

struct WrongQuestionsView: View {
    @StateObject var viewModel: WrongQuestionsViewModel

    var body: some View {
        VStack(spacing: 0) {
            if let error = viewModel.actionError {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(.red)
                    .padding(.horizontal)
                    .padding(.top, 8)
            }

            LoadingStateView(
                state: viewModel.questions,
                emptyMessage: "\u{6682}\u{65e0}\u{9519}\u{9898}\u{8bb0}\u{5f55}\u{3002}\u{5b8c}\u{6210}\u{6279}\u{6539}\u{540e}\u{ff0c}\u{9519}\u{9898}\u{4f1a}\u{81ea}\u{52a8}\u{6c47}\u{96c6}\u{5230}\u{8fd9}\u{91cc}\u{3002}",
                onRetry: { Task { await viewModel.load() } }
            ) { _ in
                ScrollView {
                    VStack(spacing: 16) {
                        if !viewModel.dueQuestions.isEmpty {
                            sectionHeader("\u{5f85}\u{590d}\u{4e60}", count: viewModel.dueQuestions.count)
                            ForEach(viewModel.dueQuestions) { item in
                                dueCard(item)
                            }
                        }

                        if !viewModel.upcomingQuestions.isEmpty {
                            sectionHeader("\u{8ba1}\u{5212}\u{4e2d}", count: viewModel.upcomingQuestions.count)
                            ForEach(viewModel.upcomingQuestions.prefix(5)) { item in
                                upcomingRow(item)
                            }
                        }
                    }
                    .padding()
                }
            }
        }
        .background(Color(.systemGroupedBackground))
        .navigationTitle("\u{9519}\u{9898}\u{590d}\u{4e60}")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .refreshable { await viewModel.load() }
    }

    private func sectionHeader(_ title: String, count: Int) -> some View {
        HStack {
            Text(title).font(.headline)
            Text("\(count) \u{9053}").font(.caption).foregroundStyle(.secondary)
            Spacer()
        }
        .padding(.top, 4)
    }

    private func dueCard(_ item: WrongQuestionItem) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(item.subject)
                    .font(.caption)
                    .fontWeight(.medium)
                    .padding(.horizontal, 8)
                    .padding(.vertical, 4)
                    .background(Color(.systemGray6))
                    .clipShape(Capsule())

                if !item.knowledgePoint.isEmpty {
                    Text(item.knowledgePoint).font(.caption).foregroundStyle(.secondary)
                }

                Spacer()

                Text("\u{7b2c} \(item.sm2Interval) \u{6b21}\u{590d}\u{4e60}")
                    .font(.caption2)
                    .foregroundStyle(.secondary)
            }

            Text(item.questionContent)
                .font(.subheadline)
                .padding(.leading, 8)
                .overlay(alignment: .leading) {
                    Rectangle().fill(Color(.systemGray4)).frame(width: 3)
                }

            HStack(spacing: 12) {
                answerBox(title: "\u{4f60}\u{7684}\u{4f5c}\u{7b54}", text: item.studentAnswer, background: Color.red.opacity(0.08), foreground: .red)
                answerBox(title: "\u{6b63}\u{786e}\u{7b54}\u{6848}", text: item.correctAnswer, background: Color.green.opacity(0.08), foreground: .green)
            }

            reviewButtons(for: item.id)
        }
        .padding()
        .background(.regularMaterial)
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }

    private func answerBox(title: String, text: String, background: Color, foreground: Color) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(title).font(.caption2).foregroundStyle(foreground.opacity(0.7))
            Text(text.isEmpty ? "\u{2014}" : text).font(.caption).foregroundStyle(foreground)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(8)
        .background(background)
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func reviewButtons(for id: String) -> some View {
        HStack(spacing: 8) {
            reviewButton(id: id, label: "\u{5b8c}\u{5168}\u{5fd8}\u{4e86}", quality: 0, prominent: false)
            reviewButton(id: id, label: "\u{6709}\u{70b9}\u{5370}\u{8c61}", quality: 2, prominent: false)
            reviewButton(id: id, label: "\u{57fa}\u{672c}\u{638c}\u{63e1}", quality: 3, prominent: false)
            reviewButton(id: id, label: "\u{5b8c}\u{5168}\u{638c}\u{63e1}", quality: 5, prominent: true)
        }
    }

    @ViewBuilder
    private func reviewButton(id: String, label: String, quality: Int, prominent: Bool) -> some View {
        let button = Button {
            Task { await viewModel.review(id: id, quality: quality) }
        } label: {
            Text(label)
                .font(.caption2)
                .lineLimit(1)
                .minimumScaleFactor(0.8)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
        }
        .controlSize(.small)

        if prominent {
            button.buttonStyle(.borderedProminent)
        } else {
            button.buttonStyle(.bordered)
        }
    }

    private func upcomingRow(_ item: WrongQuestionItem) -> some View {
        HStack {
            Text("\(item.subject) \u{00b7} \(item.knowledgePoint.isEmpty ? "\u{9519}\u{9898}" : item.knowledgePoint)")
                .font(.subheadline)
                .foregroundStyle(.secondary)
            Spacer()
            Text(formatReviewDate(item.nextReviewAt))
                .font(.caption)
                .foregroundStyle(.tertiary)
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 10)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    private func formatReviewDate(_ iso: String) -> String {
        guard let date = Date.fromISO8601(iso) ?? ISO8601DateFormatter().date(from: iso) else {
            return "\u{5f85}\u{6392}\u{671f}"
        }
        let formatter = DateFormatter()
        formatter.dateStyle = .short
        formatter.locale = Locale(identifier: "zh_CN")
        return formatter.string(from: date)
    }
}

#Preview {
    NavigationStack {
        WrongQuestionsView(viewModel: WrongQuestionsViewModel(apiClient: APIClient(
            baseURL: URL(string: "https://example.com")!,
            tokenProvider: { nil },
            onUnauthorized: { false }
        )))
    }
}
