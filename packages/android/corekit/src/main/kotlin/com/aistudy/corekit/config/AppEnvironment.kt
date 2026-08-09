package com.aistudy.corekit.config

/**
 * 应用环境配置（镜像 iOS `AppEnvironment.swift`）。
 *
 * `baseUrl` 由 `:app` 注入（app 的 BuildConfig.API_BASE_URL，随 debug/release 切换），
 * 通过 [AppEnvironment.configure] 在 Application 启动时设置，避免 corekit 反向依赖 :app。
 */
object AppEnvironment {

    /** 高中阶段（对齐 iOS phase）。 */
    const val phase: String = "high"

    /** 应用显示名（对齐 iOS appName）。 */
    const val appName: String = "AI高中助手"

    /** 加密偏好文件名（对齐 iOS Keychain service 命名）。 */
    const val tokenStoreFileName: String = "aistudy_auth_prefs"

    @Volatile
    private var _baseUrl: String = "https://api-dev.example.com"

    /** 当前 API 基址（带末尾斜杠规范化）。 */
    val baseUrl: String
        get() = _baseUrl.ensureTrailingSlash()

    /** 由 :app 在启动时注入 BuildConfig.API_BASE_URL。 */
    fun configure(baseUrl: String) {
        _baseUrl = baseUrl
    }

    private fun String.ensureTrailingSlash(): String =
        if (endsWith("/")) this else "$this/"
}
