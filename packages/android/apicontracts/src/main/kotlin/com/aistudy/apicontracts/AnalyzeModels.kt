package com.aistudy.apicontracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Analyze
// POST /api/analyze — { content?, imageUrl?, subject } → 题目分析

@Serializable
data class AnalyzeRequest(
    val content: String? = null,
    val imageUrl: String? = null,
    val subject: String,
)

@Serializable
data class AnalyzeResponse(
    val subject: String,
    val questionType: String,
    val knowledgePoints: List<String> = emptyList(),
    val difficulty: String,
    val answer: String? = null,
    val analysis: String,
    val examPoints: List<String> = emptyList(),
)

// MARK: - Subject enum (9 Gaokao subjects — label 对齐后端中文 raw value)

@Serializable
enum class Subject(val label: String) {
    @SerialName("语文") CHINESE("语文"),
    @SerialName("数学") MATH("数学"),
    @SerialName("英语") ENGLISH("英语"),
    @SerialName("物理") PHYSICS("物理"),
    @SerialName("化学") CHEMISTRY("化学"),
    @SerialName("生物") BIOLOGY("生物"),
    @SerialName("政治") POLITICS("政治"),
    @SerialName("历史") HISTORY("历史"),
    @SerialName("地理") GEOGRAPHY("地理"),
    ;

    companion object {
        /** 后端返回中文 raw value 时按 label 反查；找不到返回 null。 */
        fun fromLabel(label: String): Subject? = entries.firstOrNull { it.label == label }
    }
}

// MARK: - QuestionType enum (中文 raw value 对齐后端)

@Serializable
enum class QuestionType(val label: String) {
    @SerialName("选择题") MULTIPLE_CHOICE("选择题"),
    @SerialName("填空题") FILL_IN_BLANK("填空题"),
    @SerialName("简答题") SHORT_ANSWER("简答题"),
    @SerialName("计算题") CALCULATION("计算题"),
    @SerialName("证明题") PROOF("证明题"),
    @SerialName("作文") ESSAY("作文"),
    ;

    companion object {
        fun fromLabel(label: String): QuestionType? = entries.firstOrNull { it.label == label }
    }
}
