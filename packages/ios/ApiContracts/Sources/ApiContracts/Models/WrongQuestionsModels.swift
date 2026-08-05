import Foundation

// MARK: - Wrong Questions

public struct WrongQuestionItem: Codable, Sendable, Identifiable {
    public let id: String
    public let questionContent: String
    public let studentAnswer: String
    public let correctAnswer: String
    public let subject: String
    public let knowledgePoint: String
    public let createdAt: String
    public let nextReviewAt: String
    public let sm2Interval: Int
    public let sm2Ease: Double

    enum CodingKeys: String, CodingKey {
        case id, questionContent, studentAnswer, correctAnswer, subject, knowledgePoint
        case createdAt, nextReviewAt
        case sm2Interval = "sm2_interval"
        case sm2Ease = "sm2_ease"
    }
}

public struct WrongQuestionsResponse: Codable, Sendable {
    public let questions: [WrongQuestionItem]
}

public struct ReviewWrongQuestionRequest: Codable, Sendable {
    public let id: String
    public let quality: Int

    public init(id: String, quality: Int) {
        self.id = id
        self.quality = quality
    }
}

public struct ReviewWrongQuestionResponse: Codable, Sendable {
    public let ok: Bool
    public let mastered: Bool
}
