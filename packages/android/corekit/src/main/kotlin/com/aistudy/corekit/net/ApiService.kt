package com.aistudy.corekit.net

import com.aistudy.apicontracts.AnalyzeRequest
import com.aistudy.apicontracts.AnalyzeResponse
import com.aistudy.apicontracts.BankCountResponse
import com.aistudy.apicontracts.ChatHistoryResponse
import com.aistudy.apicontracts.ChatRequest
import com.aistudy.apicontracts.ChatResponse
import com.aistudy.apicontracts.LoginRequest
import com.aistudy.apicontracts.LoginResponse
import com.aistudy.apicontracts.LogoutResponse
import com.aistudy.apicontracts.PlanRequest
import com.aistudy.apicontracts.PlanResponse
import com.aistudy.apicontracts.PresignUploadRequest
import com.aistudy.apicontracts.PresignUploadResponse
import com.aistudy.apicontracts.RefreshRequest
import com.aistudy.apicontracts.RefreshResponse
import com.aistudy.apicontracts.RegisterRequest
import com.aistudy.apicontracts.RegisterResponse
import com.aistudy.apicontracts.ReviewWrongQuestionRequest
import com.aistudy.apicontracts.ReviewWrongQuestionResponse
import com.aistudy.apicontracts.StatsResponse
import com.aistudy.apicontracts.UploadResponse
import com.aistudy.apicontracts.WrongQuestionsResponse
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Query
import retrofit2.http.Url

/**
 * Retrofit 服务接口 — 16 个端点（对齐 iOS `APIClient` 的全部路由）。
 *
 * 路径不含前导斜杠，相对于 [AppEnvironment.baseUrl]。
 * `grade` 返回 raw [ResponseBody]：后端按 questionType 返回不同 JSON 形状，
 * 由 GradeViewModel 按请求 questionType 用 Json.decodeFromString 选 Math/Essay（对齐 iOS）。
 */
interface ApiService {

    // MARK: - Auth
    @POST("api/auth/login")
    suspend fun login(@Body body: LoginRequest): LoginResponse

    @POST("api/auth/register")
    suspend fun register(@Body body: RegisterRequest): RegisterResponse

    @POST("api/auth/logout")
    suspend fun logout(): LogoutResponse

    @POST("api/auth/refresh")
    suspend fun refresh(@Body body: RefreshRequest): RefreshResponse

    // MARK: - Chat
    @POST("api/chat")
    suspend fun chat(@Body body: ChatRequest): ChatResponse

    @GET("api/chat/history")
    suspend fun chatHistory(
        @Query("conversationId") conversationId: String? = null,
        @Query("subject") subject: String? = null,
    ): ChatHistoryResponse

    // MARK: - Analyze / Grade / Plan
    @POST("api/analyze")
    suspend fun analyze(@Body body: AnalyzeRequest): AnalyzeResponse

    @POST("api/grade")
    suspend fun grade(@Body body: com.aistudy.apicontracts.GradeRequest): ResponseBody

    @POST("api/plan")
    suspend fun plan(@Body body: PlanRequest): PlanResponse

    // MARK: - Upload
    @POST("api/upload/presign")
    suspend fun presign(@Body body: PresignUploadRequest): PresignUploadResponse

    @POST("api/upload")
    suspend fun uploadDirect(@Body body: RequestBody): UploadResponse

    /** PUT 到对象存储预签名 URL（非 API 路由，动态 URL）。 */
    @PUT
    suspend fun putObject(
        @Url url: String,
        @Header("Content-Type") contentType: String,
        @Body body: RequestBody,
    ): ResponseBody

    // MARK: - Wrong Questions
    @GET("api/wrong-questions")
    suspend fun wrongQuestions(): WrongQuestionsResponse

    @POST("api/wrong-questions")
    suspend fun reviewWrong(@Body body: ReviewWrongQuestionRequest): ReviewWrongQuestionResponse

    // MARK: - Stats
    @GET("api/stats")
    suspend fun stats(): StatsResponse

    // MARK: - Bank Count (无鉴权)
    @GET("api/bank/count")
    suspend fun bankCount(): BankCountResponse
}
