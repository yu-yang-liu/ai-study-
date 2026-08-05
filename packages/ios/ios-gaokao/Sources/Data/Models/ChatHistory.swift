import Foundation
import SwiftData

/// 对话历史 SwiftData 模型
@Model
public final class ChatHistoryRecord {
    /// 唯一标识
    @Attribute(.unique) public var id: UUID

    /// 学段：high
    public var phase: String

    /// 对话标题（取首条用户消息前20字）
    public var title: String

    /// 学科
    public var subject: String

    /// 消息列表，JSON 编码存储
    public var messagesJSON: String

    /// 创建时间
    public var createdAt: Date

    /// 最后更新时间
    public var updatedAt: Date

    public init(
        id: UUID = UUID(),
        phase: String,
        title: String,
        subject: String,
        messagesJSON: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.phase = phase
        self.title = title
        self.subject = subject
        self.messagesJSON = messagesJSON
        self.createdAt = createdAt
        self.updatedAt = updatedAt
    }
}

/// 可编码的消息条目（JSON 序列化用）
public struct CodableChatMessage: Codable, Sendable {
    public let role: String          // "user" | "assistant"
    public let content: String
    public let timestamp: Date

    public init(role: String, content: String, timestamp: Date) {
        self.role = role
        self.content = content
        self.timestamp = timestamp
    }
}
