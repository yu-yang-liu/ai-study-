import Foundation

// MARK: - Wrong Questions

public struct WrongQuestionItem: Codable, Sendable, Identifiable {
    public let id: String
    public let questionId: String
    public let questionContent: String
    public let studentAnswer: String
    public let correctAnswer: String
    public let subject: String
    public let knowledgePoint: String
    public let createdAt: String
    public let nextReviewAt: String
    public let sm2Interval: Int
    public let sm2Ease: Double
    public let knowledgePoints: [String]
    public let errorType: String?
    public let analysis: String
    public let explanation: String
    public let isFavorite: Bool

    enum CodingKeys: String, CodingKey {
        case id, questionId, questionContent, studentAnswer, correctAnswer, subject, knowledgePoint
        case createdAt, nextReviewAt
        case sm2Interval = "sm2_interval"
        case sm2Ease = "sm2_ease"
        case knowledgePoints, errorType, analysis, explanation, isFavorite
    }

    public init(
        id: String,
        questionId: String,
        questionContent: String,
        studentAnswer: String,
        correctAnswer: String,
        subject: String,
        knowledgePoint: String,
        createdAt: String,
        nextReviewAt: String,
        sm2Interval: Int,
        sm2Ease: Double,
        knowledgePoints: [String] = [],
        errorType: String? = nil,
        analysis: String = "",
        explanation: String = "",
        isFavorite: Bool = false
    ) {
        self.id = id
        self.questionId = questionId
        self.questionContent = questionContent
        self.studentAnswer = studentAnswer
        self.correctAnswer = correctAnswer
        self.subject = subject
        self.knowledgePoint = knowledgePoint
        self.createdAt = createdAt
        self.nextReviewAt = nextReviewAt
        self.sm2Interval = sm2Interval
        self.sm2Ease = sm2Ease
        self.knowledgePoints = knowledgePoints
        self.errorType = errorType
        self.analysis = analysis
        self.explanation = explanation
        self.isFavorite = isFavorite
    }

    public init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let id = try container.decode(String.self, forKey: .id)
        self.init(
            id: id,
            questionId: try container.decodeIfPresent(String.self, forKey: .questionId) ?? id,
            questionContent: try container.decodeIfPresent(String.self, forKey: .questionContent) ?? "",
            studentAnswer: try container.decodeIfPresent(String.self, forKey: .studentAnswer) ?? "",
            correctAnswer: try container.decodeIfPresent(String.self, forKey: .correctAnswer) ?? "",
            subject: try container.decodeIfPresent(String.self, forKey: .subject) ?? "",
            knowledgePoint: try container.decodeIfPresent(String.self, forKey: .knowledgePoint) ?? "",
            createdAt: try container.decodeIfPresent(String.self, forKey: .createdAt) ?? "",
            nextReviewAt: try container.decodeIfPresent(String.self, forKey: .nextReviewAt) ?? "",
            sm2Interval: try container.decodeIfPresent(Int.self, forKey: .sm2Interval) ?? 0,
            sm2Ease: try container.decodeIfPresent(Double.self, forKey: .sm2Ease) ?? 2.5,
            knowledgePoints: try container.decodeIfPresent([String].self, forKey: .knowledgePoints) ?? [],
            errorType: try container.decodeIfPresent(String.self, forKey: .errorType),
            analysis: try container.decodeIfPresent(String.self, forKey: .analysis) ?? "",
            explanation: try container.decodeIfPresent(String.self, forKey: .explanation) ?? "",
            isFavorite: try container.decodeIfPresent(Bool.self, forKey: .isFavorite) ?? false
        )
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
