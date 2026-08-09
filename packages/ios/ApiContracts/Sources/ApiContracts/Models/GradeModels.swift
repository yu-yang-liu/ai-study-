import Foundation

// MARK: - Grade Request

/// POST /api/grade 请求体
/// 对应后端 zod schema:
/// z.object({ subject, questionType: z.enum(['math','essay']), questionContent, studentAnswer })
public struct GradeRequest: Codable, Sendable {
    public let subject: String
    public let questionType: GradeQuestionType
    public let questionContent: String
    public let studentAnswer: String

    public init(
        subject: String,
        questionType: GradeQuestionType,
        questionContent: String,
        studentAnswer: String
    ) {
        self.subject = subject
        self.questionType = questionType
        self.questionContent = questionContent
        self.studentAnswer = studentAnswer
    }
}

/// 批改题目类型（对应后端 'math' | 'essay'）
public enum GradeQuestionType: String, Codable, Sendable {
    case math
    case essay
}

// MARK: - Math Grade Response

/// 数学批改响应
/// 对应后端 TASK_SCHEMA.gradeMath → gradeMathOutput
public struct GradeMathResponse: Codable, Sendable {
    public let score: Double
    public let maxScore: Double
    public let isCorrect: Bool
    public let steps: [GradeMathStep]
    public let summary: String

    // MARK: 公式块（M1）

    /// 总结评价的公式块（可选）。后端 B 策略派生 `summary` string，iOS 优先渲染 blocks。
    public let summaryBlocks: [ContentBlock]?
}

public struct GradeMathStep: Codable, Sendable {
    public let stepNumber: Int
    public let isCorrect: Bool
    public let feedback: String

    /// 步骤反馈的公式块（可选）。iOS 优先渲染 blocks，缺省回退 `feedback` string。
    public let feedbackBlocks: [ContentBlock]?
}

// MARK: - Essay Grade Response

/// 作文批改响应
/// 对应后端 TASK_SCHEMA.gradeEssay → gradeEssayOutput
public struct GradeEssayResponse: Codable, Sendable {
    public let score: Double
    public let maxScore: Double
    /// 各维度得分，key 为维度名（如"内容""表达""结构"），value 为得分
    public let dimensions: [String: Double]
    public let strengths: [String]
    public let weaknesses: [String]
    public let summary: String
}

// MARK: - Grade Result (Union type wrapper)

/// 批改结果联合类型，客户端根据请求的 questionType 解析对应类型
public enum GradeResult: Sendable {
    case math(GradeMathResponse)
    case essay(GradeEssayResponse)
}
