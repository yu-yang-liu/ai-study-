package com.aistudy.apicontracts

import kotlinx.serialization.Serializable

// MARK: - Stats
// GET /api/stats → 学习统计仪表盘

@Serializable
data class StatsResponse(
    val totalQuestions: Int,
    val totalWrong: Int,
    val accuracy: Double,
    val avgScore: Double,
    val subjectBreakdown: Map<String, SubjectBreakdownItem> = emptyMap(),
    val recentActivity: List<RecentActivityItem> = emptyList(),
)

@Serializable
data class SubjectBreakdownItem(
    val correct: Int,
    val wrong: Int,
    val avgScore: Double,
)

@Serializable
data class RecentActivityItem(
    val date: String,
    val count: Int,
)

// MARK: - Bank Count (无鉴权)
// GET /api/bank/count → { count }

@Serializable
data class BankCountResponse(
    val count: Int,
)
