package com.aistudy.corekit.net

import okhttp3.Interceptor
import okhttp3.Response

/**
 * 自动附加 Bearer Token（镜像 iOS `tokenProvider` 闭包注入 Authorization header）。
 *
 * 由 [tokenProvider] 同步取当前 access token。无 token 时不附加（如 login/register/refresh/bankCount）。
 */
class AuthInterceptor(
    private val tokenProvider: () -> String?,
) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val request = chain.request()
        val token = tokenProvider()
        val newRequest = if (token != null && request.header("Authorization") == null) {
            request.newBuilder()
                .header("Authorization", "Bearer $token")
                .build()
        } else {
            request
        }
        return chain.proceed(newRequest)
    }
}
