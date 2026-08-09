package com.aistudy.apicontracts

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class WrongQuestionsModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Test
    fun `wrong question item decodes sm2 snake_case fields`() {
        val payload = """
            {
              "id": "w1",
              "questionContent": "1+1=?",
              "studentAnswer": "3",
              "correctAnswer": "2",
              "subject": "数学",
              "knowledgePoint": "加法",
              "createdAt": "2026-01-01T00:00:00Z",
              "nextReviewAt": "2026-01-02T00:00:00Z",
              "sm2_interval": 2,
              "sm2_ease": 2.5
            }
        """.trimIndent()

        val item = json.decodeFromString<WrongQuestionItem>(payload)
        assertEquals("w1", item.id)
        assertEquals(2, item.sm2Interval)
        assertEquals(2.5, item.sm2Ease, 0.0001)
        assertEquals("数学", item.subject)
    }

    @Test
    fun `review response decodes ok and mastered`() {
        val payload = """{"ok":true,"mastered":false}"""
        val resp = json.decodeFromString<ReviewWrongQuestionResponse>(payload)
        assertTrue(resp.ok)
        assertEquals(false, resp.mastered)
    }
}
