package com.aistudy.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * 批改记录缓存（镜像 iOS `GradeRecord` SwiftData 模型）。
 * `questionType` 为 "math" / "essay"，`resultJson` 为按型解码前的原始 JSON。
 */
@Entity(tableName = "grade_records")
data class GradeRecordEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val phase: String,
    val subject: String,
    val questionType: String,
    val questionContent: String,
    val studentAnswer: String,
    val resultJson: String,
    val score: Double,
    val maxScore: Double,
    val createdAt: Long,
)
