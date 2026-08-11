import Foundation
import SwiftData
import ApiContracts

/// 对话历史 SwiftData 模型
@Model
public final class ChatHistoryRecord: @unchecked Sendable {
    /// 唯一标识
    @Attribute(.unique) public var id: UUID

    /// Remote account identifier that owns this record.
    /// Optional to allow lightweight migration of pre-isolation records.
    public var userID: String?

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
        userID: String? = nil,
        phase: String,
        title: String,
        subject: String,
        messagesJSON: String,
        createdAt: Date = Date(),
        updatedAt: Date = Date()
    ) {
        self.id = id
        self.userID = userID
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
    public let imagePreviewBase64: String?
    public let imageUrl: String?
    public let action: ChatActionPayload?
    public let analyzeResult: AnalyzeResponse?
    public let replyBlocks: [ContentBlock]?

    public init(
        role: String,
        content: String,
        timestamp: Date,
        imagePreviewBase64: String? = nil,
        imageUrl: String? = nil,
        action: ChatActionPayload? = nil,
        analyzeResult: AnalyzeResponse? = nil,
        replyBlocks: [ContentBlock]? = nil
    ) {
        self.role = role
        self.content = content
        self.timestamp = timestamp
        self.imagePreviewBase64 = imagePreviewBase64
        self.imageUrl = imageUrl
        self.action = action
        self.analyzeResult = analyzeResult
        self.replyBlocks = replyBlocks
    }
}
