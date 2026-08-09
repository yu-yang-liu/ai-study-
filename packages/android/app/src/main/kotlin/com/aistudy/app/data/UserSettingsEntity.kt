package com.aistudy.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.time.LocalDate
import java.time.temporal.ChronoUnit

/**
 * 用户个性化设置单例（镜像 iOS `UserSettings` SwiftData 模型）。
 * 通过固定 [singletonId] 保证唯一。`examDate` 存 epoch day，`daysRemaining` 据今日推算。
 */
@Entity(tableName = "user_settings")
data class UserSettingsEntity(
    @PrimaryKey val id: String = singletonId,
    val nickname: String = "同学",
    /** 距离考试的剩余天数（缓存值，UI 用此显示倒计时）。 */
    val daysRemaining: Int,
    val targetScore: Double = 0.0,
    val notificationsEnabled: Boolean = true,
    val gradeLevel: String = "高三",
    val track: String = "未分科",
    val themeMode: String = "system",
    val examDateEpochDay: Long = defaultExamDateEpochDay(),
    val updatedAt: Long = System.currentTimeMillis(),
) {
    companion object {
        const val singletonId = "00000000-0000-0000-0000-000000000001"

        /** 默认考试日期：高考 6 月 7 日；若已过则推到次年（对齐 iOS `defaultExamDate`）。 */
        fun defaultExamDateEpochDay(today: LocalDate = LocalDate.now()): Long {
            val thisYear = today.year
            val candidate = LocalDate.of(thisYear, 6, 7)
            return if (candidate.isBefore(today)) {
                LocalDate.of(thisYear + 1, 6, 7).toEpochDay()
            } else {
                candidate.toEpochDay()
            }
        }

        /** 计算距离考试日的剩余天数（≥0）。 */
        fun daysRemainingFrom(examDateEpochDay: Long, today: LocalDate = LocalDate.now()): Int =
            ChronoUnit.DAYS.between(today, LocalDate.ofEpochDay(examDateEpochDay)).toInt().coerceAtLeast(0)
    }
}
