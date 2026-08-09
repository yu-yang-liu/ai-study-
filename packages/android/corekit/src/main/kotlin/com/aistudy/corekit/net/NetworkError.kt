package com.aistudy.corekit.net

/**
 * 统一网络错误（镜像 iOS `NetworkError`）。ViewModel 在 catch 分支按类型映射用户文案。
 *
 * - [Unauthorized]：401 且刷新失败 → AuthManager 置 Unauthenticated。
 * - [RateLimited]：429，携带 `Retry-After` 秒数。
 * - [Server]：其它非 2xx。
 * - [Decode]：JSON 解码失败。
 * - [NetworkUnavailable]：连接失败 / 超时。
 */
sealed class NetworkError(message: String) : Throwable(message) {
    data object NetworkUnavailable : NetworkError("网络不可用，请检查连接")
    data class RateLimited(val retryAfterSeconds: Int) :
        NetworkError("请求过于频繁，请 ${retryAfterSeconds}s 后重试")
    data object Unauthorized : NetworkError("登录已失效，请重新登录")
    data class Server(val code: Int, val messageText: String?) :
        NetworkError(messageText ?: "服务器错误 ($code)")
    data class Decode(val decodeMessage: String) :
        NetworkError("数据解析失败：$decodeMessage")
}
