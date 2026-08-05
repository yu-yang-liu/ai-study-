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
        .navigationTitle("\u9898\u76ee\u5206\u6790")
        .navigationBarTitleDisplayMode(.inline)
    }

    private var inputSection: some View {
        VStack(spacing: 12) {
            HStack {
                Text("\u5b66\u79d1")
                    .font(.subheadline)

                Picker("\u5b66\u79d1", selection: $viewModel.selectedSubject) {
                    ForEach(viewModel.subjects, id: \.self) { subject in
                        Text(subject).tag(subject)
                    }
                }
                .pickerStyle(.menu)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            VStack(alignment: .leading, spacing: 4) {
                Text("\u9898\u76ee\u5185\u5bb9\uff08\u81f3\u5c1110\u5b57\uff09")
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
                    Text("\u5f00\u59cb\u5206\u6790")
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
            EmptyPlaceholderView(message: "\u8f93\u5165\u9898\u76ee\u5185\u5bb9\uff0cAI \u5c06\u4e3a\u4f60\u5206\u6790\u9898\u5e72\u3001\u77e5\u8bc6\u70b9\u548c\u89e3\u7b54\u601d\u8def")

        case .loading:
            Spacer()
            ProgressView("\u6b63\u5728\u5206\u6790...")
            Spacer()

        case .loaded(let response):
            ScrollView {
                AnalysisResultView(result: response)
                    .padding()
            }

        case .empty:
            EmptyPlaceholderView(message: "\u6682\u65e0\u5206\u6790\u7ed3\u679c")

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
