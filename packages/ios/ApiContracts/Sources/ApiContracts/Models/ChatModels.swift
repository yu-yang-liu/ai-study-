import Foundation

// MARK: - Chat

/// POST /api/chat 请求体
public struct ChatRequest: Codable, Sendable {
    public let subject: String
    public let message: String
    public let conversationId: String?
    public let context: String?

    public init(
        subject: String,
        message: String,
        conversationId: String? = nil,
        context: String? = nil
    ) {
        self.subject = subject
        self.message = message
        self.conversationId = conversationId
        self.context = context
    }
}

/// POST /api/chat 响应体
public struct ChatResponse: Codable, Sendable {
    public let reply: String
    /// 结构化回复块（双字段过渡：reply 恒有，replyBlocks 供 iOS 优先渲染）。
    public let replyBlocks: [ContentBlock]?
    public let conversationId: String?
    public let action: ChatActionPayload?
}

public struct ChatActionPayload: Codable, Sendable {
    public let type: String
    public let payload: [String: JSONValue]
}

/// GET /api/chat/history 响应体
public struct ChatHistoryResponse: Codable, Sendable {
    public let conversationId: String?
    public let messages: [ChatHistoryMessage]?
    public let conversations: [ChatConversationSummary]?
}

public struct ChatHistoryMessage: Codable, Sendable {
    public let role: String
    public let content: String
    public let createdAt: String?
    public let imageUrl: String?
    public let action: ChatActionPayload?
    public let analyzeResult: AnalyzeResponse?
    public let replyBlocks: [ContentBlock]?
}

public struct ChatHistoryAppendMessage: Codable, Sendable {
    public let role: String
    public let content: String
    public let metadata: ChatHistoryMessageMetadata?

    public init(
        role: String,
        content: String,
        metadata: ChatHistoryMessageMetadata? = nil
    ) {
        self.role = role
        self.content = content
        self.metadata = metadata
    }
}

public struct ChatHistoryMessageMetadata: Codable, Sendable {
    public let imageUrl: String?
    public let action: ChatActionPayload?
    public let analyzeResult: AnalyzeResponse?
    public let replyBlocks: [ContentBlock]?

    public init(
        imageUrl: String? = nil,
        action: ChatActionPayload? = nil,
        analyzeResult: AnalyzeResponse? = nil,
        replyBlocks: [ContentBlock]? = nil
    ) {
        self.imageUrl = imageUrl
        self.action = action
        self.analyzeResult = analyzeResult
        self.replyBlocks = replyBlocks
    }
}

public struct ChatHistoryAppendRequest: Codable, Sendable {
    public let subject: String
    public let conversationId: String?
    public let messages: [ChatHistoryAppendMessage]

    public init(
        subject: String,
        conversationId: String? = nil,
        messages: [ChatHistoryAppendMessage]
    ) {
        self.subject = subject
        self.conversationId = conversationId
        self.messages = messages
    }
}

public struct ChatHistoryAppendResponse: Codable, Sendable {
    public let conversationId: String
}

public struct ChatConversationSummary: Codable, Sendable {
    public let id: String
    public let title: String
    public let updatedAt: String
}

/// 宽松 JSON 值，用于 action payload
public enum JSONValue: Codable, Sendable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case object([String: JSONValue])
    case array([JSONValue])
    case null

    public init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else {
            self = .null
        }
    }

    public func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        case .array(let value): try container.encode(value)
        case .null: try container.encodeNil()
        }
    }

    public var stringValue: String? {
        if case .string(let value) = self { return value }
        return nil
    }

    public var doubleValue: Double? {
        if case .number(let value) = self { return value }
        return nil
    }

    public var arrayValue: [JSONValue]? {
        if case .array(let value) = self { return value }
        return nil
    }

    public var objectValue: [String: JSONValue]? {
        if case .object(let value) = self { return value }
        return nil
    }
}
