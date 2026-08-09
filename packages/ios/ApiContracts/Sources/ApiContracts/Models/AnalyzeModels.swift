import Foundation

// MARK: - Analyze Request

/// POST /api/analyze 请求体
/// 对应后端：content (min 10) 或 imageUrl 二选一
public struct AnalyzeRequest: Codable, Sendable {
    public let content: String?
    public let imageUrl: String?
    public let subject: String

    public init(content: String? = nil, imageUrl: String? = nil, subject: String) {
        self.content = content
        self.imageUrl = imageUrl
        self.subject = subject
    }
}

// MARK: - Analyze Response

/// POST /api/analyze 响应体
/// 对应后端 TASK_SCHEMA.analyze → analyzeOutput
public struct AnalyzeResponse: Codable, Sendable {
    /// 学科：语文/数学/英语/物理/化学/生物/政治/历史/地理
    public let subject: String

    /// 题型：选择题/填空题/简答题/计算题/证明题/作文
    public let questionType: String

    /// 知识点列表
    public let knowledgePoints: [String]

    /// 难度 1-10
    public let difficulty: Int

    /// 参考答案（可选）
    public let answer: String?

    /// 解析
    public let analysis: String

    /// 考点说明（可选）
    public let examPoints: String?

    // MARK: 公式块（M1）

    /// 参考答案的公式块（可选）。后端 B 策略：模型输出 blocks，派生同名 string。
    /// iOS 优先渲染 blocks，缺省回退 `answer` string（降级为单个 text block）。
    public let answerBlocks: [ContentBlock]?

    /// 解析的公式块（可选）。
    public let analysisBlocks: [ContentBlock]?

    /// 考点说明的公式块（可选）。
    public let examPointsBlocks: [ContentBlock]?

    enum CodingKeys: String, CodingKey {
        case subject
        case questionType
        case knowledgePoints
        case difficulty
        case answer
        case analysis
        case examPoints
        case answerBlocks
        case analysisBlocks
        case examPointsBlocks
    }
}

// MARK: - Subject & QuestionType enums

/// 学科枚举，对应后端 subjectSchema
public enum Subject: String, Codable, Sendable, CaseIterable {
    case chinese = "语文"
    case math = "数学"
    case english = "英语"
    case physics = "物理"
    case chemistry = "化学"
    case biology = "生物"
    case politics = "政治"
    case history = "历史"
    case geography = "地理"
}

/// 题型枚举，对应后端 analyzeOutput.questionType
public enum QuestionType: String, Codable, Sendable, CaseIterable {
    case choice = "选择题"
    case fillBlank = "填空题"
    case shortAnswer = "简答题"
    case calculation = "计算题"
    case proof = "证明题"
    case essay = "作文"
}
