package com.aistudy.corekit.net

/**
 * API 端点路径常量（镜像 iOS `APIEndpoint.swift`）。
 * 集中管理便于核对与 iOS / Web route 一致。Retrofit 注解里直接写字符串，这里作参考与单测断言用。
 */
object ApiEndpoint {
    const val LOGIN = "api/auth/login"
    const val REGISTER = "api/auth/register"
    const val LOGOUT = "api/auth/logout"
    const val REFRESH = "api/auth/refresh"
    const val CHAT = "api/chat"
    const val CHAT_HISTORY = "api/chat/history"
    const val ANALYZE = "api/analyze"
    const val GRADE = "api/grade"
    const val PLAN = "api/plan"
    const val UPLOAD = "api/upload"
    const val UPLOAD_PRESIGN = "api/upload/presign"
    const val WRONG_QUESTIONS = "api/wrong-questions"
    const val REVIEW_WRONG_QUESTION = "api/wrong-questions"
    const val STATS = "api/stats"
    const val BANK_COUNT = "api/bank/count"
}
