package com.aistudy.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * 学习计划缓存（镜像 iOS `PlanCache` SwiftData 模型）。
 * 用于离线时回退展示最近一次生成的计划（对齐 iOS `isOffline`/`showCachedBanner`）。
 */
@Entity(tableName = "plan_cache")
data class PlanCacheEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val phase: String,
    val subject: String,
    val focus: String?,
    val planJson: String,
    val createdAt: Long,
)
