import Foundation

// MARK: - Learner Model (Personalization)

/// 知识点掌握度条目
public struct KnowledgeMasteryEntry: Codable, Sendable {
    public let knowledgePoint: String
    public let level: Double          // 0-1
    public let lastSeen: String       // ISO 8601
    public let trend: MasteryTrend
}

public enum MasteryTrend: String, Codable, Sendable {
    case up, flat, down
}

/// 错误类型画像
public struct ErrorProfile: Codable, Sendable {
    public let type: String
    public let count: Int
    public let recentRate: Double
}

/// 学习节奏
public struct LearnerPace: Codable, Sendable {
    public let avgDailyMinutes: Double
    public let activeHours: [Int]
    public let streakDays: Int
}

/// 学习者偏好
public struct LearnerPreferences: Codable, Sendable {
    public let explainStyle: ExplainStyle?
    public let preferredDifficulty: Int?
}

public enum ExplainStyle: String, Codable, Sendable {
    case concise = "简洁"
    case detailed = "详细"
    case stepwise = "步骤化"
}

/// 学习者完整画像模型
public struct LearnerModel: Codable, Sendable {
    public let mastery: [String: KnowledgeMasteryEntry]
    public let abilities: [String: Double]
    public let errorProfile: [ErrorProfile]
    public let weakSubjects: [String]
    public let strongSubjects: [String]
    public let pace: LearnerPace
    public let preferences: LearnerPreferences
    public let targetScore: Double?
    public let dataRichness: Double   // 0-1, cold start indicator
}

/// 学习事件（用于服务端记录学习轨迹）
public struct LearningEvent: Codable, Sendable {
    public let userId: String
    public let phase: String          // 'high'
    public let type: String           // analyze/grade/practice/chat/plan_followed/review
    public let subject: String
    public let knowledgePoints: [String]
    public let isCorrect: Bool?
    public let score: Double?
    public let maxScore: Double?
    public let errorType: String?
    public let abilityAssessment: [String: String]?
    public let durationSec: Int?
    public let createdAt: String
}
