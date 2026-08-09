package com.aistudy.apicontracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Wrong Questions
// GET /api/wrong-questions  → 错题列表
// POST /api/wrong-questions → { id, quality } SM-2 复习评分

@Serializable
data class WrongQuestionItem(
    val id: String,
    val questionContent: String,
    val studentAnswer: String,
    val correctAnswer: String,
    val subject: String,
    val knowledgePoint: String,
    val createdAt: String,
    val nextReviewAt: String,
    @SerialName("sm2_interval") val sm2Interval: Int,
    @SerialName("sm2_ease") val sm2Ease: Double,
)

@Serializable
data class WrongQuestionsResponse(
    val questions: List<WrongQuestionItem> = emptyList(),
)

/** SM-2 quality 0..5（对齐后端 review route）。 */
@Serializable
data class ReviewWrongQuestionRequest(
    val id: String,
    val quality: Int,
)

@Serializable
data class ReviewWrongQuestionResponse(
    val ok: Boolean,
    val mastered: Boolean,
)
