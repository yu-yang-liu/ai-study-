package com.aistudy.corekit.config

/**
 * 功能开关（镜像 iOS `FeatureFlags.swift`）。
 * 全部默认开启，除 `isLearnerProfileEnabled`（与 iOS 一致地保持关闭，本期不接入）。
 */
object FeatureFlags {
    val isChatEnabled: Boolean = true
    val isAnalyzeEnabled: Boolean = true
    val isGradeEnabled: Boolean = true
    val isPlanEnabled: Boolean = true
    val isWrongQuestionsEnabled: Boolean = true
    val isStatsEnabled: Boolean = true
    val isUploadEnabled: Boolean = true
    val isRealExamEnabled: Boolean = false
    val isLearnerProfileEnabled: Boolean = false
}
