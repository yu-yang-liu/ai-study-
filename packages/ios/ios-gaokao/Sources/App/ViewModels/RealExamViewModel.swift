import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class RealExamViewModel: ObservableObject {
    @Published var questions: LoadingState<[BankQuestionItem]> = .idle
    @Published private(set) var filters = BankFilterOptions()
    @Published private(set) var total = 0

    @Published var subjectFilter = "全部"
    @Published var yearFilter = 0
    @Published var questionTypeFilter = "全部"
    @Published var difficultyFilter = 0

    let apiClient: APIClient

    init(apiClient: APIClient) {
        self.apiClient = apiClient
    }

    var subjectOptions: [String] {
        ["全部"] + filters.subjects
    }

    var yearOptions: [Int] {
        [0] + filters.years
    }

    var questionTypeOptions: [String] {
        ["全部"] + filters.questionTypes
    }

    var difficultyOptions: [Int] {
        [0] + filters.difficulties
    }

    func load() async {
        questions = .loading
        do {
            let response = try await apiClient.fetchBankQuestions(
                subject: subjectFilter == "全部" ? nil : subjectFilter,
                year: yearFilter == 0 ? nil : yearFilter,
                questionType: questionTypeFilter == "全部" ? nil : questionTypeFilter,
                difficulty: difficultyFilter == 0 ? nil : difficultyFilter
            )
            filters = response.filters
            total = response.total
            questions = response.questions.isEmpty ? .empty : .loaded(response.questions)
        } catch {
            questions = .error(error)
        }
    }

    func resetFilters() {
        subjectFilter = "全部"
        yearFilter = 0
        questionTypeFilter = "全部"
        difficultyFilter = 0
    }

    func reloadAfterFilterChange() async {
        await load()
    }
}
