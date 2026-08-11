import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class WrongQuestionsViewModel: ObservableObject {
    @Published var questions: LoadingState<[WrongQuestionItem]> = .idle
    @Published var actionError: String?
    @Published var searchText = ""
    @Published var subjectFilter = "鍏ㄩ儴"
    @Published private(set) var updatingFavoriteIDs: Set<String> = []

    private let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    var dueQuestions: [WrongQuestionItem] {
        filteredItems.filter { isDue($0) }
    }

    var upcomingQuestions: [WrongQuestionItem] {
        filteredItems.filter { !isDue($0) }
    }

    var subjectOptions: [String] {
        let values = Set((questions.value ?? []).map(\.subject)).sorted()
        return ["鍏ㄩ儴"] + values
    }

    private var filteredItems: [WrongQuestionItem] {
        let query = searchText.trimmingCharacters(in: .whitespacesAndNewlines).lowercased()
        return (questions.value ?? []).filter { item in
            let matchesSubject = subjectFilter == "鍏ㄩ儴" || item.subject == subjectFilter
            guard !query.isEmpty else { return matchesSubject }
            let haystack = [
                item.questionContent,
                item.subject,
                item.knowledgePoints.joined(separator: " "),
                item.errorType ?? "",
            ].joined(separator: " ").lowercased()
            return matchesSubject && haystack.contains(query)
        }
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

    @discardableResult
    func addManualQuestion(_ request: AddWrongQuestionRequest) async -> Bool {
        actionError = nil
        do {
            _ = try await apiClient.addWrongQuestion(request)
            await load()
            return true
        } catch {
            actionError = error.localizedDescription
            return false
        }
    }

    func updateFavorite(_ item: WrongQuestionItem) async {
        let nextValue = !item.isFavorite
        updatingFavoriteIDs.insert(item.id)
        defer { updatingFavoriteIDs.remove(item.id) }
        do {
            _ = try await apiClient.updateAnalysisBookmark(questionId: item.questionId, isFavorite: nextValue)
            guard var items = questions.value,
                  let index = items.firstIndex(where: { $0.id == item.id }) else { return }
            let current = items[index]
            items[index] = WrongQuestionItem(
                id: current.id,
                questionId: current.questionId,
                questionContent: current.questionContent,
                studentAnswer: current.studentAnswer,
                correctAnswer: current.correctAnswer,
                subject: current.subject,
                knowledgePoint: current.knowledgePoint,
                createdAt: current.createdAt,
                nextReviewAt: current.nextReviewAt,
                sm2Interval: current.sm2Interval,
                sm2Ease: current.sm2Ease,
                knowledgePoints: current.knowledgePoints,
                errorType: current.errorType,
                analysis: current.analysis,
                explanation: current.explanation,
                isFavorite: nextValue
            )
            questions = .loaded(items)
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
