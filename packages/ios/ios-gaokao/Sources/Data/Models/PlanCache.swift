import Foundation
import SwiftData

/// 学习计划缓存 SwiftData 模型
@Model
public final class PlanCache: @unchecked Sendable {
    /// 唯一标识
    @Attribute(.unique) public var id: UUID

    /// Remote account identifier that owns this record.
    /// Optional to allow lightweight migration of pre-isolation records.
    public var userID: String?

    /// 学段
    public var phase: String

    /// 学科
    public var subject: String

    /// 学习重点（可选）
    public var focus: String?

    /// 计划结果 JSON
    public var planJSON: String

    /// 创建时间
    public var createdAt: Date

    public init(
        id: UUID = UUID(),
        userID: String? = nil,
        phase: String,
        subject: String,
        focus: String? = nil,
        planJSON: String,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.userID = userID
        self.phase = phase
        self.subject = subject
        self.focus = focus
        self.planJSON = planJSON
        self.createdAt = createdAt
    }
}
