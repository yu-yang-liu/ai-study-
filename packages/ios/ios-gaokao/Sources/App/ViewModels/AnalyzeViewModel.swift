import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class AnalyzeViewModel: ObservableObject {
    @Published var content = ""
    @Published var selectedSubject: String = "数学"
    @Published var result: LoadingState<AnalyzeResponse> = .idle

    private let apiClient: APIClient
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    func analyze() async {
        let text = content.trimmingCharacters(in: .whitespacesAndNewlines)
        guard text.count >= 10 else {
            result = .error(AnalyzeError.contentTooShort)
            return
        }
        result = .loading
        do {
            let request = AnalyzeRequest(content: text, subject: selectedSubject)
            let response = try await apiClient.analyze(request)
            result = .loaded(response)
        } catch {
            result = .error(error)
        }
    }
}

enum AnalyzeError: Error, LocalizedError {
    case contentTooShort
    var errorDescription: String? {
        switch self { case .contentTooShort: return "请输入至少10个字的题目内容" }
    }
}