import SwiftUI
import CoreKit
import ApiContracts

@MainActor
final class GradeViewModel: ObservableObject {
    @Published var subject: String = "数学"
    @Published var questionType: GradeQuestionType = .math
    @Published var questionContent = ""
    @Published var studentAnswer = ""
    @Published var result: LoadingState<GradeResult> = .idle
    @Published var historyRecords: [GradeRecord] = []
    @Published var isOffline = false

    private let apiClient: APIClient
    private let dataRepository: DataRepository
    let subjects: [String] = Subject.allCases.map(\.rawValue)

    init(apiClient: APIClient, dataRepository: DataRepository) {
        self.apiClient = apiClient
        self.dataRepository = dataRepository
        Task { await loadHistory() }
    }

    func loadHistory() async {
        historyRecords = await dataRepository.fetchGradeRecords()
    }

    func submitForGrading() async {
        let qContent = questionContent.trimmingCharacters(in: .whitespacesAndNewlines)
        let sAnswer = studentAnswer.trimmingCharacters(in: .whitespacesAndNewlines)
        guard qContent.count >= 10 else { result = .error(GradeError.questionTooShort); return }
        guard !sAnswer.isEmpty else { result = .error(GradeError.answerEmpty); return }

        result = .loading
        do {
            let request = GradeRequest(subject: subject, questionType: questionType, questionContent: qContent, studentAnswer: sAnswer)
            let rawData = try await apiClient.grade(request)
            let gradeResult: GradeResult
            let score: Double
            let maxScore: Double
            let resultJSON: String

            if questionType == .math {
                let mathResp = try JSONDecoder().decode(GradeMathResponse.self, from: rawData)
                gradeResult = .math(mathResp)
                score = mathResp.score
                maxScore = mathResp.maxScore
                resultJSON = String(data: rawData, encoding: .utf8) ?? "{}"
            } else {
                let essayResp = try JSONDecoder().decode(GradeEssayResponse.self, from: rawData)
                gradeResult = .essay(essayResp)
                score = essayResp.score
                maxScore = essayResp.maxScore
                resultJSON = String(data: rawData, encoding: .utf8) ?? "{}"
            }

            result = .loaded(gradeResult)
            isOffline = false

            await dataRepository.saveGradeRecord(
                subject: subject, questionType: questionType.rawValue,
                questionContent: qContent, studentAnswer: sAnswer,
                resultJSON: resultJSON, score: score, maxScore: maxScore
            )
            await loadHistory()
        } catch {
            result = .error(error)
            isOffline = (error as? NetworkError) == .networkUnavailable
            if isOffline { await loadHistoryFromCache() }
        }
    }

    private func loadHistoryFromCache() async {
        historyRecords = await dataRepository.fetchGradeRecords()
    }
}

enum GradeError: Error, LocalizedError {
    case questionTooShort, answerEmpty
    var errorDescription: String? {
        switch self {
        case .questionTooShort: return "请输入至少10字的题目内容"
        case .answerEmpty: return "请输入你的作答内容"
        }
    }
}