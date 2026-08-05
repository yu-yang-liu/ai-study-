import Foundation

// MARK: - Plan Request

/// POST /api/plan 请求体
/// 对应后端 zod schema: z.object({ subject: z.string().min(1), focus: z.string().optional() })
public struct PlanRequest: Codable, Sendable {
    public let subject: String
    public let focus: String?

    public init(subject: String, focus: String? = nil) {
        self.subject = subject
        self.focus = focus
    }
}

// MARK: - Plan Response

/// POST /api/plan 响应体
/// 对应后端 TASK_SCHEMA.plan → planOutput
public struct PlanResponse: Codable, Sendable {
    public let title: String
    public let description: String
    public let tasks: [PlanTask]
    public let createdAt: String?
}

/// 学习计划中的单个任务
public struct PlanTask: Codable, Sendable, Identifiable {
    public let title: String
    public let subject: String
    public let knowledgePoints: [String]
    public let estimatedMinutes: Int
    public let priority: PlanPriority
    public let reason: String

    public var id: String { title }
}

/// 任务优先级，对应后端 '高'｜'中'｜'低'
public enum PlanPriority: String, Codable, Sendable {
    case high = "高"
    case medium = "中"
    case low = "低"
}
