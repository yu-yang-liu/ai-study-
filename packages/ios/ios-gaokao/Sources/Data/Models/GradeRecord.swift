import Foundation
import SwiftData

/// 批改记录 SwiftData 模型
@Model
public final class GradeRecord: @unchecked Sendable {
    /// 唯一标识
    @Attribute(.unique) public var id: UUID

    /// Remote account identifier that owns this record.
    /// Optional to allow lightweight migration of pre-isolation records.
    public var userID: String?

    /// 学段
    public var phase: String

    /// 学科
    public var subject: String

    /// 题目类型：math / essay
    public var questionType: String

    /// 题目内容
    public var questionContent: String

    /// 学生作答
    public var studentAnswer: String

    /// 批改结果 JSON
    public var resultJSON: String

    /// 得分
    public var score: Double

    /// 满分
    public var maxScore: Double

    /// 创建时间
    public var createdAt: Date

    public init(
        id: UUID = UUID(),
        userID: String? = nil,
        phase: String,
        subject: String,
        questionType: String,
        questionContent: String,
        studentAnswer: String,
        resultJSON: String,
        score: Double,
        maxScore: Double,
        createdAt: Date = Date()
    ) {
        self.id = id
        self.userID = userID
        self.phase = phase
        self.subject = subject
        self.questionType = questionType
        self.questionContent = questionContent
        self.studentAnswer = studentAnswer
        self.resultJSON = resultJSON
        self.score = score
        self.maxScore = maxScore
        self.createdAt = createdAt
    }
}
