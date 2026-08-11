import Foundation

public struct ProfileResponse: Codable, Sendable {
    public let nickname: String?
    public let examDate: String?
    public let targetScore: Double?
    public let notificationsEnabled: Bool?
    public let gradeLevel: String?
    public let track: String?
    public let themeMode: String?
}

public struct ProfileUpdateRequest: Codable, Sendable {
    public let nickname: String?
    public let examDate: String?
    public let targetScore: Double?
    public let notificationsEnabled: Bool?
    public let gradeLevel: String?
    public let track: String?
    public let themeMode: String?

    public init(
        nickname: String? = nil,
        examDate: String? = nil,
        targetScore: Double? = nil,
        notificationsEnabled: Bool? = nil,
        gradeLevel: String? = nil,
        track: String? = nil,
        themeMode: String? = nil
    ) {
        self.nickname = nickname
        self.examDate = examDate
        self.targetScore = targetScore
        self.notificationsEnabled = notificationsEnabled
        self.gradeLevel = gradeLevel
        self.track = track
        self.themeMode = themeMode
    }
}
