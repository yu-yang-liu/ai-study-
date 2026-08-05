import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class WrongQuestionsViewModel: ObservableObject {
    @Published var questions: LoadingState<[WrongQuestionItem]> = .idle
    @Published var actionError: String?

    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    var dueQuestions: [WrongQuestionItem] {
        guard let items = questions.value else { return [] }
        return items.filter { isDue($0) }
    }

    var upcomingQuestions: [WrongQuestionItem] {
        guard let items = questions.value else { return [] }
        return items.filter { !isDue($0) }
    }

    func load() async {
        questions = .loading
        do {
            let response = try await apiClient.fetchWrongQuestions()
            let items = response.questions
            questions = items.isEmpty ? .empty : .loaded(items)
        } catch {
            questions = .error(error)
        }
    }

    func review(id: String, quality: Int) async {
        actionError = nil
        do {
            _ = try await apiClient.reviewWrongQuestion(ReviewWrongQuestionRequest(id: id, quality: quality))
            if var items = questions.value {
                items.removeAll { $0.id == id }
                questions = items.isEmpty ? .empty : .loaded(items)
            }
        } catch {
            actionError = error.localizedDescription
        }
    }

    private func isDue(_ item: WrongQuestionItem) -> Bool {
        guard !item.nextReviewAt.isEmpty else { return true }
        guard let date = parseDate(item.nextReviewAt) else { return true }
        return date <= Date()
    }

    private func parseDate(_ string: String) -> Date? {
        Date.fromISO8601(string)
            ?? ISO8601DateFormatter().date(from: string)
    }
}
