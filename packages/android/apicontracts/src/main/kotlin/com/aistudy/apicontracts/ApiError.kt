package com.aistudy.apicontracts

import kotlinx.serialization.Serializable

// MARK: - 统一错误响应壳
// 后端出错时统一返回 { "error": "..." }（对齐 iOS ApiError）。

@Serializable
data class ApiError(
    val error: String,
)
