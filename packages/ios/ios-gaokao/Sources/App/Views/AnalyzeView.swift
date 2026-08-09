import SwiftUI
import CoreKit
import ApiContracts

/// 题目分析页
struct AnalyzeView: View {
    @StateObject var viewModel: AnalyzeViewModel

    var body: some View {
        VStack(spacing: 0) {
            inputSection
            Divider()
            resultSection
        }
        .navigationTitle("\u{9898}\u{76ee}\u{5206}\u{6790}")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var inputSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\u{5b66}\u{79d1}")
                    .font(.subheadline)

                Picker("\u{5b66}\u{79d1}", selection: $viewModel.selectedSubject) {
                    ForEach(viewModel.subjects, id: \.self) { subject in
                        Text(subject).tag(subject)
                    }
                }
                .pickerStyle(.menu)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                Text("\u{9898}\u{76ee}\u{5185}\u{5bb9}\u{ff08}\u{81f3}\u{5c11}10\u{5b57}\u{ff09}")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                TextEditor(text: $viewModel.content)
                    .frame(minHeight: 120, maxHeight: 200)
                    .overlay(
                        RoundedRectangle(cornerRadius: 8)
                            .stroke(Color(.systemGray4), lineWidth: 0.5)
                    )
            }

            Button {
                Task { await viewModel.analyze() }
            } label: {
                if viewModel.result.isLoading {
                    ProgressView()
                        .tint(.white)
                } else {
                    Text("\u{5f00}\u{59cb}\u{5206}\u{6790}")
                }
            }
            .buttonStyle(.borderedProminent)
            .frame(maxWidth: .infinity)
            .disabled(viewModel.content.trimmingCharacters(in: .whitespacesAndNewlines).count < 10)
        }
        .padding()
    }

    @ViewBuilder
    private var resultSection: some View {
        switch viewModel.result {
        case .idle:
            EmptyPlaceholderView(message: "\u{8f93}\u{5165}\u{9898}\u{76ee}\u{5185}\u{5bb9}\u{ff0c}AI \u{5c06}\u{4e3a}\u{4f60}\u{5206}\u{6790}\u{9898}\u{5e72}\u{3001}\u{77e5}\u{8bc6}\u{70b9}\u{548c}\u{89e3}\u{7b54}\u{601d}\u{8def}")

        case .loading:
            CenteredProgressView("\u{6b63}\u{5728}\u{5206}\u{6790}...")

        case .loaded(let response):
            ScrollView {
                AnalysisResultView(result: response)
                    .padding()
            }

        case .empty:
            EmptyPlaceholderView(message: "\u{6682}\u{65e0}\u{5206}\u{6790}\u{7ed3}\u{679c}")

        case .error(let error):
            ErrorPlaceholderView(error: error) {
                Task { await viewModel.analyze() }
            }
        }
    }
}

#Preview {
    NavigationStack {
        AnalyzeView(viewModel: AnalyzeViewModel(apiClient: APIClient(
            baseURL: URL(string: "https://example.com")!,
            tokenProvider: { nil },
            onUnauthorized: { false }
        )))
    }
}
