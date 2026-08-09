package com.aistudy.app.data

import androidx.room.Entity
import androidx.room.PrimaryKey
import java.util.UUID

/**
 * 对话历史缓存（镜像 iOS `ChatHistoryRecord` SwiftData 模型）。
 * `messagesJSON` 为消息列表 JSON 串（角色/内容/时间戳）。
 */
@Entity(tableName = "chat_history")
data class ChatHistoryEntity(
    @PrimaryKey val id: String = UUID.randomUUID().toString(),
    val phase: String,
    val title: String,
    val subject: String,
    val messagesJson: String,
    val createdAt: Long,
    val updatedAt: Long,
)
