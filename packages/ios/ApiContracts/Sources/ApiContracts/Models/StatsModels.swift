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
}

public struct BankCountResponse: Codable, Sendable {
    public let count: Int
}
