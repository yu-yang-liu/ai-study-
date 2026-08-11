import Foundation

public struct ActivePlanResponse: Codable, Sendable {
    public let plan: PlanResponse?
}

public struct GradeHistoryItem: Codable, Sendable, Identifiable {
    public let id: String
    public let subject: String
    public let questionType: String?
    public let questionContent: String
    public let studentAnswer: String
    public let score: Double
    public let maxScore: Double
    public let resultJSON: String?
    public let createdAt: String

    public init(
        id: String,
        subject: String,
        questionType: String?,
        questionContent: String,
        studentAnswer: String,
        score: Double,
        maxScore: Double,
        resultJSON: String?,
        createdAt: String
    ) {
        self.id = id
        self.subject = subject
        self.questionType = questionType
        self.questionContent = questionContent
        self.studentAnswer = studentAnswer
        self.score = score
        self.maxScore = maxScore
        self.resultJSON = resultJSON
        self.createdAt = createdAt
    }

    public var identity: String { id }
}

public struct GradeHistoryResponse: Codable, Sendable {
    public let records: [GradeHistoryItem]
}
