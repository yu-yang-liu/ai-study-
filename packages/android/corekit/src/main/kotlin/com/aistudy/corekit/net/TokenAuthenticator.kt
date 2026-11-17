package com.aistudy.corekit.net

import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response
import okhttp3.Route

/**
 * 401 刷新重试一次（镜像 iOS `perform(allowRetry:)` + `onUnauthorized`）。
 *
 * 仅处理 401，且 `responseCount == 1`（防无限重试）。
 * 成功刷新 → 用新 token 重发原请求；失败返回 null（→ 上层保持 401 → 置 Unauthenticated）。
 *
 * 刷新走单飞 mutex（在 [tokenRefresher] 内部实现），保证并发请求只触发一次刷新。
 * `tokenRefresher` 在 OkHttp Authenticator 的同步上下文调用，与 iOS actor 串行化语义一致。
 *
 * 构造参数仅保留 [tokenRefresher]：刷新完全委托给它，无需直接持有 TokenStorage，
 * 也使本类可作纯 JVM JUnit 测试（无需 Robolectric）。
 */
class TokenAuthenticator(
    private val tokenRefresher: () -> String?,
) : Authenticator {

    override fun authenticate(route: Route?, response: Response): Request? {
        // 已重试过一次则不再刷新，避免循环。
        if (responseCount(response) >= 2) return null

        val newToken = try {
            tokenRefresher()
        } catch (_: Exception) {
            null
        } ?: return null

        return response.request.newBuilder()
            .header("Authorization", "Bearer $newToken")
            .build()
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
