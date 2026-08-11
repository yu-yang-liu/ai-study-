import Foundation

// MARK: - Question Bank

public struct BankQuestionItem: Codable, Sendable, Identifiable, Hashable {
    public let id: String
    public let subject: String
    public let year: Int?
    public let topic: String?
    public let examPoint: String?
    public let questionType: String?
    public let content: String
    public let options: [String]
    public let difficulty: Int?
    public let source: String?

    public init(
        id: String,
        subject: String,
        year: Int? = nil,
        topic: String? = nil,
        examPoint: String? = nil,
        questionType: String? = nil,
        content: String,
        options: [String] = [],
        difficulty: Int? = nil,
        source: String? = nil
    ) {
        self.id = id
        self.subject = subject
        self.year = year
        self.topic = topic
        self.examPoint = examPoint
        self.questionType = questionType
        self.content = content
        self.options = options
        self.difficulty = difficulty
        self.source = source
    }

    enum CodingKeys: String, CodingKey {
        case id, subject, year, topic, content, options, difficulty, source
        case examPoint, questionType
    }
}

public struct BankFilterOptions: Codable, Sendable {
    public let subjects: [String]
    public let years: [Int]
    public let questionTypes: [String]
    public let difficulties: [Int]

    public init(
        subjects: [String] = [],
        years: [Int] = [],
        questionTypes: [String] = [],
        difficulties: [Int] = []
    ) {
        self.subjects = subjects
        self.years = years
        self.questionTypes = questionTypes
        self.difficulties = difficulties
    }
}

public struct BankQuestionListResponse: Codable, Sendable {
    public let questions: [BankQuestionItem]
    public let total: Int
    public let filters: BankFilterOptions
}

public struct BankPracticeRequest: Codable, Sendable {
    public let questionId: String
    public let userAnswer: String
    public let durationSec: Int?
    public let clientRequestId: String?

    public init(
        questionId: String,
        userAnswer: String,
        durationSec: Int? = nil,
        clientRequestId: String? = nil
    ) {
        self.questionId = questionId
        self.userAnswer = userAnswer
        self.durationSec = durationSec
        self.clientRequestId = clientRequestId
    }
}

public struct BankPracticeResponse: Codable, Sendable {
    public let practiceRecordId: String
    public let questionId: String
    public let isCorrect: Bool
    public let score: Double
    public let maxScore: Double
    public let correctAnswer: String
    public let analysis: String
    public let examPoint: String?
}
