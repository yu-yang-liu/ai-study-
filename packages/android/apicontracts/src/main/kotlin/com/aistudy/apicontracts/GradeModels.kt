package com.aistudy.apicontracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Grade
// POST /api/grade — { subject, questionType, questionContent, studentAnswer }
// 后端按 questionType 返回不同 JSON 形状；客户端用 raw JSON 解码（对齐 iOS GradeResult union）。

@Serializable
data class GradeRequest(
    val subject: String,
    val questionType: GradeQuestionType,
    val questionContent: String,
    val studentAnswer: String,
)

/** 仅两种批改题型（对齐后端 grade route 的 questionType zod）。 */
@Serializable
enum class GradeQuestionType(val value: String) {
    @SerialName("math") MATH("math"),
    @SerialName("essay") ESSAY("essay"),
}

// MARK: - Math 批改结果

@Serializable
data class GradeMathResponse(
    val score: Double,
    val maxScore: Double,
    val isCorrect: Boolean,
    val steps: List<GradeMathStep> = emptyList(),
    val summary: String,
)

@Serializable
data class GradeMathStep(
    val stepNumber: Int,
    val isCorrect: Boolean,
    val feedback: String,
)

// MARK: - Essay 批改结果

@Serializable
data class GradeEssayResponse(
    val score: Double,
    val maxScore: Double,
    val dimensions: Map<String, Double> = emptyMap(),
    val strengths: List<String> = emptyList(),
    val weaknesses: List<String> = emptyList(),
    val summary: String,
)

// MARK: - 联合类型（客户端按 questionType 选型解码）

/**
 * 对齐 iOS `GradeResult` union。`grade` 接口返回 raw JSON（ResponseBody），
 * 由 GradeViewModel 按请求时的 `questionType` 用 `Json.decodeFromString` 选 Math/Essay。
 */
sealed interface GradeResult {
    data class Math(val data: GradeMathResponse) : GradeResult
    data class Essay(val data: GradeEssayResponse) : GradeResult
}
