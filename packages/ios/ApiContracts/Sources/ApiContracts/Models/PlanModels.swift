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

    public init(title: String, description: String, tasks: [PlanTask], createdAt: String? = nil) {
        self.title = title
        self.description = description
        self.tasks = tasks
        self.createdAt = createdAt
    }
}

/// 学习计划中的单个任务
public struct PlanTask: Codable, Sendable, Identifiable {
    public let taskId: String?
    public let title: String
    public let subject: String
    public let knowledgePoints: [String]
    public let estimatedMinutes: Int
    public let priority: PlanPriority
    public let reason: String
    public let status: String?
    public let completedAt: String?
    public let skippedAt: String?

    public var id: String { taskId ?? title }

    public init(
        taskId: String? = nil,
        title: String,
        subject: String,
        knowledgePoints: [String],
        estimatedMinutes: Int,
        priority: PlanPriority,
        reason: String,
        status: String? = nil,
        completedAt: String? = nil,
        skippedAt: String? = nil
    ) {
        self.taskId = taskId
        self.title = title
        self.subject = subject
        self.knowledgePoints = knowledgePoints
        self.estimatedMinutes = estimatedMinutes
        self.priority = priority
        self.reason = reason
        self.status = status
        self.completedAt = completedAt
        self.skippedAt = skippedAt
    }
}

/// 任务优先级，对应后端 '高'｜'中'｜'低'
public enum PlanPriority: String, Codable, Sendable {
    case high = "高"
    case medium = "中"
    case low = "低"
}

public struct PlanTaskUpdateRequest: Codable, Sendable {
    public let status: String

    public init(status: String) {
        self.status = status
    }
}

public struct PlanTaskUpdateResponse: Codable, Sendable {
    public let task: PlanTask
}
