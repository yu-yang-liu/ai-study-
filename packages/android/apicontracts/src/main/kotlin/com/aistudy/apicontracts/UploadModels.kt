package com.aistudy.apicontracts

import kotlinx.serialization.Serializable

// MARK: - Upload
// POST /api/upload/presign → 预签名 URL，PUT 到对象存储后再回调
// POST /api/upload       → 直传（base64 / 小文件）

@Serializable
data class UploadResponse(
    val url: String,
    val key: String,
)

@Serializable
data class PresignUploadRequest(
    val contentType: String,
)

@Serializable
data class PresignUploadResponse(
    val uploadUrl: String,
    val key: String,
    val url: String,
)
