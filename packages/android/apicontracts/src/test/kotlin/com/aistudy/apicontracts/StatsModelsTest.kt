package com.aistudy.apicontracts

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class StatsModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Test
    fun `stats response decodes nested breakdown and activity`() {
        val payload = """
            {
              "totalQuestions": 100,
              "totalWrong": 20,
              "accuracy": 0.8,
              "avgScore": 78.5,
              "subjectBreakdown": {
                "数学": { "correct": 30, "wrong": 10, "avgScore": 80.0 }
              },
              "recentActivity": [
                { "date": "2026-08-01", "count": 5 }
              ]
            }
        """.trimIndent()

        val resp = json.decodeFromString<StatsResponse>(payload)
        assertEquals(100, resp.totalQuestions)
        assertEquals(0.8, resp.accuracy, 0.0001)
        assertEquals(80.0, resp.subjectBreakdown["数学"]?.avgScore!!, 0.0001)
        assertEquals(1, resp.recentActivity.size)
        assertEquals(5, resp.recentActivity[0].count)
    }

    @Test
    fun `bank count decodes`() {
        val payload = """{"count": 1234}"""
        val resp = json.decodeFromString<BankCountResponse>(payload)
        assertEquals(1234, resp.count)
    }
}

class ChatModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Test
    fun `chat response decodes action payload map`() {
        val payload = """
            {
              "reply": "已生成计划",
              "conversationId": "c1",
              "action": {
                "type": "generate_plan",
                "payload": {
                  "title": "数学冲刺",
                  "tasks": 3
                }
              }
            }
        """.trimIndent()

        val resp = json.decodeFromString<ChatResponse>(payload)
        assertEquals("已生成计划", resp.reply)
        assertEquals("c1", resp.conversationId)
        assertEquals("generate_plan", resp.action?.type)
        assertEquals("数学冲刺", resp.action?.payload?.get("title")?.asString())
    }
}
