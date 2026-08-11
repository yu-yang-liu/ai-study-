import Foundation

// MARK: - Stats

public struct SubjectBreakdownItem: Codable, Sendable {
    public let correct: Int
    public let wrong: Int
    public let avgScore: Int
}

public struct RecentActivityItem: Codable, Sendable, Identifiable {
    public let date: String
    public let count: Int

    public var id: String { date }
}

public struct StatsResponse: Codable, Sendable {
    public let totalQuestions: Int
    public let totalWrong: Int
    public let accuracy: Int
    public let avgScore: Int
    public let subjectBreakdown: [String: SubjectBreakdownItem]
    public let recentActivity: [RecentActivityItem]
    public let trend: [StatsTrendItem]?
    public let mastery: [MasteryStatsItem]?
    public let abilities: [String: Double]?
    public let abilityTrend: [AbilityTrendItem]?
}

public struct StatsTrendItem: Codable, Sendable, Identifiable {
    public let date: String
    public let count: Int
    public let accuracy: Int
    public let avgScore: Int
    public var id: String { date }
}

public struct MasteryStatsItem: Codable, Sendable, Identifiable {
    public let knowledgePoint: String
    public let subject: String
    public let level: Double
    public let trend: String
    public let lastSeen: String
    public var id: String { "\(subject)-\(knowledgePoint)" }
}

public struct AbilityTrendItem: Codable, Sendable, Identifiable {
    public let date: String
    public let abilities: [String: Double]
    public var id: String { date }
}

public struct BankCountResponse: Codable, Sendable {
    public let count: Int
}
