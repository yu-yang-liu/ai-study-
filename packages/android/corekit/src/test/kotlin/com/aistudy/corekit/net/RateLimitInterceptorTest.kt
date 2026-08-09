package com.aistudy.corekit.net

import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Before
import org.junit.Test

/**
 * [RateLimitInterceptor] 单测（纯 JVM JUnit + MockWebServer）。
 *
 * 覆盖：429 带 `Retry-After` → 抛 [NetworkError.RateLimited] 携带秒数；
 * 429 无 header → `retryAfterSeconds == 0`；非 429 正常放行。
 */
class RateLimitInterceptorTest {

    private lateinit var server: MockWebServer

    @Before
    fun setUp() {
        server = MockWebServer()
        server.start()
    }

    @After
    fun tearDown() {
        server.shutdown()
    }

    private fun client(): OkHttpClient = OkHttpClient.Builder()
        .addInterceptor(RateLimitInterceptor())
        .build()

    @Test
    fun `429 with Retry-After seconds throws RateLimited with seconds`() {
        server.enqueue(MockResponse().setResponseCode(429).setHeader("Retry-After", "30"))

        try {
            client().newCall(Request.Builder().url(server.url("/")).build()).execute()
            fail("Expected NetworkError.RateLimited")
        } catch (e: NetworkError.RateLimited) {
            assertEquals(30, e.retryAfterSeconds)
        }
    }

    @Test
    fun `429 without Retry-After yields zero seconds`() {
        server.enqueue(MockResponse().setResponseCode(429))

        try {
            client().newCall(Request.Builder().url(server.url("/")).build()).execute()
            fail("Expected NetworkError.RateLimited")
        } catch (e: NetworkError.RateLimited) {
            assertEquals(0, e.retryAfterSeconds)
        }
    }

    @Test
    fun `429 with non-numeric Retry-After yields zero seconds`() {
        server.enqueue(MockResponse().setResponseCode(429).setHeader("Retry-After", "Wed, 21 Oct 2026 07:28:00 GMT"))

        try {
            client().newCall(Request.Builder().url(server.url("/")).build()).execute()
            fail("Expected NetworkError.RateLimited")
        } catch (e: NetworkError.RateLimited) {
            assertEquals(0, e.retryAfterSeconds)
        }
    }

    @Test
    fun `200 response passes through`() {
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val response = client().newCall(Request.Builder().url(server.url("/")).build()).execute()
        response.use {
            assertEquals(200, it.code)
            assertTrue(it.body?.string() == "ok")
        }
    }
}
