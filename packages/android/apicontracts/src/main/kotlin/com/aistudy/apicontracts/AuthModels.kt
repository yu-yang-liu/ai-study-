package com.aistudy.apicontracts

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

// MARK: - Login
// POST /api/auth/login — mirrors Swift LoginRequest / LoginResponse

@Serializable
data class LoginRequest(
    val email: String,
    val password: String,
)

@Serializable
data class LoginResponse(
    val user: UserInfo? = null,
    val session: SessionInfo? = null,
)

// MARK: - Register
// POST /api/auth/register — backend zod: password min(8)

@Serializable
data class RegisterRequest(
    val email: String,
    val password: String,
)

@Serializable
data class RegisterResponse(
    val user: UserInfo? = null,
    val message: String,
)

// MARK: - Logout

@Serializable
data class LogoutResponse(
    val message: String,
)

// MARK: - Token Refresh
// POST /api/auth/refresh — { refreshToken } → { accessToken, expiresAt, refreshToken? }

@Serializable
data class RefreshRequest(
    val refreshToken: String,
)

@Serializable
data class RefreshResponse(
    val accessToken: String,
    val expiresAt: Int,
    val refreshToken: String? = null,
)

// MARK: - Shared Auth Types

@Serializable
data class UserInfo(
    val id: String,
    val email: String,
)

@Serializable
data class SessionInfo(
    @SerialName("access_token") val accessToken: String,
    @SerialName("refresh_token") val refreshToken: String? = null,
    @SerialName("expires_at") val expiresAt: Int,
)
