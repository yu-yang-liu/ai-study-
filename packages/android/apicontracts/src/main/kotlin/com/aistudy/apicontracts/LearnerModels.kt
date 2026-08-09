package com.aistudy.apicontracts

import kotlinx.serialization.Serializable

// MARK: - Learner Profile 契约
// 镜像 iOS LearnerModels。本期 App 未必全部用到，但契约先建齐，便于后续接入
// `FeatureFlags.isLearnerProfileEnabled`（与 iOS 一致地默认关闭）。

@Serializable
data class LearnerModel(
    val knowledgeMastery: List<KnowledgeMasteryEntry> = emptyList(),
    val masteryTrend: List<MasteryTrend> = emptyList(),
    val errorProfile: ErrorProfile? = null,
    val pace: LearnerPace? = null,
    val preferences: LearnerPreferences? = null,
)

@Serializable
data class KnowledgeMasteryEntry(
    val subject: String,
    val topic: String,
    val mastery: Double,
    val lastSeen: String? = null,
)

@Serializable
data class MasteryTrend(
    val date: String,
    val mastery: Double,
)

@Serializable
data class ErrorProfile(
    val frequentErrors: List<String> = emptyList(),
    val weakTopics: List<String> = emptyList(),
)

@Serializable
data class LearnerPace(
    val avgMinutesPerTask: Double,
    val tasksPerWeek: Double,
)

@Serializable
data class LearnerPreferences(
    val explainStyle: ExplainStyle? = null,
    val dailyGoalMinutes: Int? = null,
)

@Serializable
enum class ExplainStyle(val label: String) {
    CONCISE("简洁"),
    DETAILED("详细"),
    STEP_BY_STEP("分步"),
}

@Serializable
data class LearningEvent(
    val type: String,
    val subject: String? = null,
    val timestamp: String,
    val metadata: Map<String, String> = emptyMap(),
)
