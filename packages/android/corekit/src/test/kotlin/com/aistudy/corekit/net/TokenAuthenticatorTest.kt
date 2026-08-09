package com.aistudy.corekit.net

import okhttp3.OkHttpClient
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Before
import org.junit.Test

/**
 * [TokenAuthenticator] 单测（纯 JVM JUnit + MockWebServer）。
 *
 * 覆盖：401 → 刷新成功 → 重试带新 token；刷新失败 → 返回原 401；
 * 已重试一次仍 401（priorResponse 链）→ 不再重试，防无限循环。
 */
class TokenAuthenticatorTest {

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

    @Test
    fun `401 then refresh succeeds retries with new token`() {
        // 首个响应 401，重试响应 200。
        server.enqueue(MockResponse().setResponseCode(401))
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val refreshed = mutableListOf<String?>()
        val client = OkHttpClient.Builder()
            .authenticator(TokenAuthenticator(tokenRefresher = {
                refreshed.add("new-token")
                "new-token"
            }))
            .build()

        val response = client.newCall(
            Request.Builder().url(server.url("/")).build(),
        ).execute()
        response.use {
            assertEquals(200, it.code)
        }

        // 刷新被调用一次，且重试请求携带了新 token。
        assertEquals(listOf("new-token"), refreshed)
        val retryRequest = server.takeRequest()
        assertEquals(null, retryRequest.getHeader("Authorization")) // 首次无 token
        val retriedRequest = server.takeRequest()
        assertEquals("Bearer new-token", retriedRequest.getHeader("Authorization"))
    }

    @Test
    fun `401 and refresh returns null yields original 401`() {
        server.enqueue(MockResponse().setResponseCode(401))

        val client = OkHttpClient.Builder()
            .authenticator(TokenAuthenticator(tokenRefresher = { null }))
            .build()

        val response = client.newCall(
            Request.Builder().url(server.url("/")).build(),
        ).execute()
        response.use {
            assertEquals(401, it.code)
        }
        // 仅一次请求（刷新失败不重试）。
        assertEquals(1, server.requestCount)
    }

    @Test
    fun `401 that already has priorResponse does not refresh again`() {
        // 直接构造一条带 priorResponse 的 401 响应（responseCount==2），
        // 断言 authenticator 不再调用 refresher、原样返回该 401。
        val request = Request.Builder().url(server.url("/")).build()
        val priorResponse = Response.Builder()
            .request(request)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .body("".toResponseBody(null))
            .build()
        val retriedResponse = Response.Builder()
            .request(request)
            .priorResponse(priorResponse)
            .protocol(Protocol.HTTP_1_1)
            .code(401)
            .message("Unauthorized")
            .body("".toResponseBody(null))
            .build()

        var refreshCalls = 0
        val authenticator = TokenAuthenticator(tokenRefresher = {
            refreshCalls++
            "should-not-be-called"
        })

        val route: okhttp3.Route? = null
        val result = authenticator.authenticate(route, retriedResponse)

        // 已重试过一次 → 返回 null（OkHttp 语义：放弃重试），且不调用刷新。
        assertEquals(null, result)
        assertEquals(0, refreshCalls)
    }

    @Test
    fun `non-401 response passes through untouched`() {
        server.enqueue(MockResponse().setResponseCode(200).setBody("ok"))

        val client = OkHttpClient.Builder()
            .authenticator(TokenAuthenticator(tokenRefresher = { "should-not-be-used" }))
            .build()

        val response = client.newCall(
            Request.Builder().url(server.url("/")).build(),
        ).execute()
        response.use {
            assertEquals(200, it.code)
        }
        assertEquals(1, server.requestCount)
    }
}
