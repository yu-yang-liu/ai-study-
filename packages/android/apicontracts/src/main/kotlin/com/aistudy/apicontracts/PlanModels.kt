package com.aistudy.apicontracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Plan
// POST /api/plan — { subject, focus? } → 个性化学习计划

@Serializable
data class PlanRequest(
    val subject: String,
    val focus: String? = null,
)

@Serializable
data class PlanResponse(
    val title: String,
    val description: String,
    val tasks: List<PlanTask> = emptyList(),
    val createdAt: String? = null,
)

@Serializable
data class PlanTask(
    val title: String,
    val subject: String,
    val knowledgePoints: List<String> = emptyList(),
    val estimatedMinutes: Int,
    val priority: PlanPriority,
    val reason: String,
)

@Serializable
enum class PlanPriority(val label: String) {
    @SerialName("高") HIGH("高"),
    @SerialName("中") MEDIUM("中"),
    @SerialName("低") LOW("低"),
    ;

    companion object {
        fun fromLabel(label: String): PlanPriority? = entries.firstOrNull { it.label == label }
    }
}
