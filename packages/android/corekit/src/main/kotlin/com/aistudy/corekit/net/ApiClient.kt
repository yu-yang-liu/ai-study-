package com.aistudy.corekit.net

import com.aistudy.corekit.auth.AuthManager
import com.aistudy.corekit.auth.TokenStorage
import com.aistudy.corekit.config.AppEnvironment
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.RequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.scalars.ScalarsConverterFactory
import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import kotlinx.serialization.json.Json
import java.util.concurrent.TimeUnit

/**
 * API 客户端入口（镜像 iOS `APIClient.swift` 的装配 + `uploadImage`）。
 *
 * - 30s 超时（对齐 iOS）。
 * - 自动附加 Bearer Token（[AuthInterceptor]）。
 * - 401 刷新重试一次（[TokenAuthenticator]）。
 * - 429 Retry-After 解析（[RateLimitInterceptor]）。
 * - [uploadImage]：presign → PUT S3 → 返回 url（对齐 iOS uploadImage）。
 */
class ApiClient(
    private val apiService: ApiService,
    private val okHttpClient: OkHttpClient,
) {
    val api: ApiService get() = apiService

    /**
     * 上传图片：presign → PUT 到对象存储 → 返回最终可访问 url。
     * @param bytes 图片字节
     * @param mimeType 如 "image/jpeg"
     * @return [UploadResponse]（url = presign 返回的可访问 url，key）
     */
    suspend fun uploadImage(bytes: ByteArray, mimeType: String): com.aistudy.apicontracts.UploadResponse {
        val presign = apiService.presign(
            com.aistudy.apicontracts.PresignUploadRequest(contentType = mimeType),
        )
        val body = bytes.toRequestBody(mimeType.toMediaTypeOrNull())
        apiService.putObject(url = presign.uploadUrl, contentType = mimeType, body = body)
        return com.aistudy.apicontracts.UploadResponse(url = presign.url, key = presign.key)
    }

    companion object {
        /** 共享 JSON 配置（ignoreUnknownKeys + explicitNulls=false + coerceInputValues）。 */
        val json: Json = Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            coerceInputValues = true
            encodeDefaults = true
        }

        /**
         * 装配 [ApiClient]：OkHttp + Retrofit + 鉴权拦截器。
         * @param tokenStorage 令牌存储
         * @param authManager 鉴权管理器（提供 currentAccessToken / refreshAfterUnauthorized）
         * @param debug 是否打印网络日志
         */
        fun create(
            tokenStorage: TokenStorage,
            authManager: AuthManager,
            debug: Boolean,
        ): ApiClient {
            val authenticator = TokenAuthenticator {
                kotlinx.coroutines.runBlocking { authManager.refreshAfterUnauthorized() }
            }
            val authInterceptor = AuthInterceptor { authManager.currentAccessToken() }
            val rateLimitInterceptor = RateLimitInterceptor()

            val builder = OkHttpClient.Builder()
                .connectTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .readTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .writeTimeout(TIMEOUT_SECONDS, TimeUnit.SECONDS)
                .addInterceptor(authInterceptor)
                .addInterceptor(rateLimitInterceptor)
                .authenticator(authenticator)

            if (debug) {
                builder.addInterceptor(
                    HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY },
                )
            }

            val client = builder.build()

            val contentType = "application/json".toMediaTypeOrNull()!!
            val retrofit = Retrofit.Builder()
                .baseUrl(AppEnvironment.baseUrl)
                .client(client)
                .addConverterFactory(ScalarsConverterFactory.create())
                .addConverterFactory(json.asConverterFactory(contentType))
                .build()

            return ApiClient(
                apiService = retrofit.create(ApiService::class.java),
                okHttpClient = client,
            )
        }

        private const val TIMEOUT_SECONDS = 30L
    }
}
