package com.aistudy.apicontracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonElement

// MARK: - Content
// 题库/内容记录（GET /api/bank 等）。data 为松散 JSON，按 content_type 解释。

@Serializable
data class ContentRecord(
    val id: String,
    val phase: String,
    val subject: String,
    @SerialName("content_type") val contentType: String,
    val title: String,
    val data: Map<String, JsonElement> = emptyMap(),
)
