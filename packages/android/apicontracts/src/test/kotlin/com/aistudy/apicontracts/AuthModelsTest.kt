package com.aistudy.apicontracts

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 验证 @Serializable 数据契约能正确解码后端 JSON，
 * 重点覆盖 snake_case 字段（@SerialName）与 ignoreUnknownKeys 容错。
 * 对齐 iOS ApiContracts 的 Codable 单测意图。
 */
class AuthModelsTest {

    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
        coerceInputValues = true
    }

    @Test
    fun `login response decodes snake_case session fields`() {
        val payload = """
            {
              "user": { "id": "u1", "email": "a@b.com" },
              "session": {
                "access_token": "atk",
                "refresh_token": "rtk",
                "expires_at": 1700000000
              },
              "extra": "ignored"
            }
        """.trimIndent()

        val resp = json.decodeFromString<LoginResponse>(payload)
        assertEquals("u1", resp.user?.id)
        assertEquals("atk", resp.session?.accessToken)
        assertEquals("rtk", resp.session?.refreshToken)
        assertEquals(1700000000, resp.session?.expiresAt)
    }

    @Test
    fun `login response tolerates missing optional fields`() {
        val payload = """{"user":{"id":"u1","email":"a@b.com"}}"""
        val resp = json.decodeFromString<LoginResponse>(payload)
        assertEquals("u1", resp.user?.id)
        assertNull(resp.session)
    }

    @Test
    fun `refresh response decodes without optional refresh_token`() {
        val payload = """{"accessToken":"a","expiresAt":100}"""
        val resp = json.decodeFromString<RefreshResponse>(payload)
        assertEquals("a", resp.accessToken)
        assertEquals(100, resp.expiresAt)
        assertNull(resp.refreshToken)
    }
}
