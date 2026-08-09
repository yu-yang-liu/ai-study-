package com.aistudy.apicontracts

import kotlinx.serialization.Serializable

// MARK: - Chat
// POST /api/chat — { subject, message(1-2000), conversationId? } → { reply, conversationId?, action? }

@Serializable
data class ChatRequest(
    val subject: String,
    val message: String,
    val conversationId: String? = null,
)

@Serializable
data class ChatResponse(
    val reply: String,
    val conversationId: String? = null,
    val action: ChatActionPayload? = null,
)

/**
 * Discriminated action card returned by the Chat Agent.
 * `payload` is a loose JSON object (mirrors iOS ChatActionPayload payload: [String: JSONValue]);
 * clients read keys by `type` (e.g. generate_plan → plan card, summarize_wrong_questions → summary).
 */
@Serializable
data class ChatActionPayload(
    val type: String,
    val payload: Map<String, JsonElement> = emptyMap(),
)

// MARK: - Chat History
// GET /api/chat/history?conversationId=|subject=

@Serializable
data class ChatHistoryResponse(
    val conversationId: String? = null,
    val messages: List<ChatHistoryMessage>? = null,
    val conversations: List<ChatConversationSummary>? = null,
)

@Serializable
data class ChatHistoryMessage(
    val role: String,
    val content: String,
    val createdAt: String? = null,
)

@Serializable
data class ChatConversationSummary(
    val id: String,
    val title: String,
    val updatedAt: String,
)
