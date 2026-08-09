package com.aistudy.corekit.auth

import com.aistudy.apicontracts.UserInfo

/**
 * 鉴权状态（镜像 iOS `AuthState`）。
 * UI 据此切换：Loading → splash；Unauthenticated → 登录页；Authenticated → 主界面。
 */
sealed interface AuthState {
    data object Loading : AuthState
    data class Authenticated(val user: UserInfo) : AuthState
    data object Unauthenticated : AuthState
    data class Error(val message: String) : AuthState
}
