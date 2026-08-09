package com.aistudy.corekit.net

import okhttp3.Interceptor
import okhttp3.Response

/**
 * 429 Retry-After 解析（镜像 iOS 手动读 header → 抛 RateLimited）。
 *
 * OkHttp 的 Authenticator 不处理 429，故在拦截器里拦截：解析 `Retry-After`
 * （秒数或 HTTP-date；这里只处理秒数，date 形态回退为 0）→ 抛 [NetworkError.RateLimited]。
 */
class RateLimitInterceptor : Interceptor {

    override fun intercept(chain: Interceptor.Chain): Response {
        val response = chain.proceed(chain.request())
        if (response.code != 429) return response

        val retryAfterHeader = response.header("Retry-After")
        val seconds = retryAfterHeader?.toIntOrNull() ?: 0
        response.close()
        throw NetworkError.RateLimited(retryAfterSeconds = seconds)
    }
}
