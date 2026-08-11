import Foundation

public struct AddWrongQuestionRequest: Codable, Sendable {
    public let subject: String
    public let questionContent: String
    public let studentAnswer: String
    public let correctAnswer: String
    public let knowledgePoints: [String]
    public let errorType: String?

    public init(
        subject: String,
        questionContent: String,
        studentAnswer: String,
        correctAnswer: String,
        knowledgePoints: [String] = [],
        errorType: String? = nil
    ) {
        self.subject = subject
        self.questionContent = questionContent
        self.studentAnswer = studentAnswer
        self.correctAnswer = correctAnswer
        self.knowledgePoints = knowledgePoints
        self.errorType = errorType
    }
}

public struct AddWrongQuestionResponse: Codable, Sendable {
    public let ok: Bool
    public let id: String
}

public struct AnalysisBookmarkRequest: Codable, Sendable {
    public let isFavorite: Bool

    public init(isFavorite: Bool) {
        self.isFavorite = isFavorite
    }
}

public struct AnalysisBookmarkResponse: Codable, Sendable {
    public let ok: Bool
    public let isFavorite: Bool
}
