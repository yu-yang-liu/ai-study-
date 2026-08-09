package com.aistudy.corekit.net

import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

/**
 * 401 刷新重试一次（镜像 iOS `perform(allowRetry:)` + `onUnauthorized`）。
 *
 * 仅处理 401，且 `responseCount == 1`（防无限重试）。
 * 成功刷新 → 用新 token 重发原请求；失败返回原 401（→ 上层置 Unauthenticated）。
 *
 * 刷新走单飞 mutex（在 [tokenRefresher] 内部实现），保证并发请求只触发一次刷新。
 * `runBlocking` 在 OkHttp Authenticator 上下文是同步的，与 iOS actor 串行化语义一致。
 *
 * 构造参数仅保留 [tokenRefresher]：刷新完全委托给它，无需直接持有 TokenStorage，
 * 也使本类可作纯 JVM JUnit 测试（无需 Robolectric）。
 */
class TokenAuthenticator(
    private val tokenRefresher: () -> String?,
) : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val originalResponse = chain.proceed(chain.request())
        if (originalResponse.code != 401) return originalResponse

        // 已重试过一次则不再刷新，避免循环。
        if (responseCount(originalResponse) >= 2) return originalResponse

        val newToken = try {
            runBlocking { tokenRefresher() }
        } catch (_: Exception) {
            null
        } ?: return originalResponse.also { /* 刷新失败：保持 401 给上层 */ }

        originalResponse.close()

        val newRequest = chain.request().newBuilder()
            .header("Authorization", "Bearer $newToken")
            .build()
        return chain.proceed(newRequest)
    }

    private fun responseCount(response: Response): Int {
        var current: Response? = response
        var count = 1
        while (current?.priorResponse != null) {
            count++
            current = current.priorResponse
        }
        return count
    }
}
