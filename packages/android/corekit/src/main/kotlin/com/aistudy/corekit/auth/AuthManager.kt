package com.aistudy.corekit.auth

import com.aistudy.apicontracts.LoginRequest
import com.aistudy.apicontracts.RefreshRequest
import com.aistudy.apicontracts.RegisterRequest
import com.aistudy.apicontracts.UserInfo
import com.aistudy.corekit.net.ApiService
import com.aistudy.corekit.net.NetworkError
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.runBlocking
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext

/**
 * 鉴权管理器（镜像 iOS `AuthManager.swift`）。
 *
 * - 持有 [StateFlow]<[AuthState]>，UI 据此切换登录/主界面。
 * - `refreshAfterUnauthorized()`：单飞 [Mutex]，防并发重复刷新（对齐 iOS actor 串行化）。
 * - `refreshTokenIfNeeded()`：`expires_at` 提前 60s 刷新（对齐 iOS 60s 早刷新）。
 * - `restoreSession()`：启动时从 TokenStorage 恢复 + 校验过期。
 * - `currentAccessToken()`：供 OkHttp Authenticator 同步取（IO 线程 runBlocking）。
 */
class AuthManager(
    private val tokenStorage: TokenStorage,
    private val api: ApiService,
) {
    private val _state = MutableStateFlow<AuthState>(AuthState.Loading)
    val state: StateFlow<AuthState> = _state.asStateFlow()

    private val refreshMutex = Mutex()

    /** 是否已认证（便捷查询）。 */
    val isAuthenticated: Boolean
        get() = _state.value is AuthState.Authenticated

    /** 当前登录用户（未登录时 null）。 */
    val currentUser: UserInfo?
        get() = (_state.value as? AuthState.Authenticated)?.user

    // MARK: - Login / Register / Logout

    suspend fun login(email: String, password: String): Result<UserInfo> =
        withContext(Dispatchers.IO) {
            runCatching {
                val resp = api.login(LoginRequest(email = email, password = password))
                val session = resp.session
                    ?: throw NetworkError.Server(500, "登录响应缺少 session")
                tokenStorage.saveSession(
                    accessToken = session.accessToken,
                    refreshToken = session.refreshToken,
                    expiresAt = session.expiresAt,
                    userId = resp.user?.id,
                    userEmail = resp.user?.email,
                )
                val user = resp.user ?: UserInfo(
                    id = tokenStorage.userId() ?: "",
                    email = tokenStorage.userEmail() ?: email,
                )
                _state.value = AuthState.Authenticated(user)
                user
            }
        }

    suspend fun register(email: String, password: String): Result<UserInfo> =
        withContext(Dispatchers.IO) {
            runCatching {
                val resp = api.register(RegisterRequest(email = email, password = password))
                // 注册成功不自动登录（等待邮箱验证），对齐 iOS。
                resp.user ?: UserInfo(id = "", email = email)
            }
        }

    suspend fun logout() {
        // 登出即使网络失败也清理本地状态（对齐 iOS performLogoutCleanup）。
        withContext(Dispatchers.IO) {
            runCatching { api.logout() }
        }
        tokenStorage.clear()
        _state.value = AuthState.Unauthenticated
    }

    // MARK: - Restore

    suspend fun restoreSession() {
        val accessToken = tokenStorage.accessToken()
        if (accessToken == null) {
            _state.value = AuthState.Unauthenticated
            return
        }
        val userId = tokenStorage.userId()
        val userEmail = tokenStorage.userEmail()
        if (userId == null) {
            _state.value = AuthState.Unauthenticated
            return
        }
        _state.value = AuthState.Authenticated(UserInfo(id = userId, email = userEmail))
        // 顺带在后台按需刷新（不阻塞 UI）。
        refreshTokenIfNeeded()
    }

    // MARK: - Refresh

    /**
     * 401 后由 TokenAuthenticator 调用。单飞：并发请求只触发一次刷新。
     * @return 新 access token；失败返回 null（→ 上层 401 → 置 Unauthenticated）。
     */
    suspend fun refreshAfterUnauthorized(): String? = refreshMutex.withLock {
        // 若 state 已非 Authenticated，说明已被并发流程登出。
        if (_state.value !is AuthState.Authenticated) return@withLock null
        // 拿锁后再检查一次当前 token：可能其它请求已经刷新成功，且本地 token 已更新。
        val expiresAt = tokenStorage.expiresAt()
        val nowSec = System.currentTimeMillis() / 1000
        if (expiresAt - nowSec > EARLY_REFRESH_SECONDS) {
            return@withLock tokenStorage.accessToken()
        }
        doRefresh()
    }

    /** 提前 60s 刷新（对齐 iOS）。供 UI 发请求前调用。 */
    suspend fun refreshTokenIfNeeded(): String? {
        val expiresAt = tokenStorage.expiresAt()
        if (expiresAt == 0) return tokenStorage.accessToken()
        val nowSec = System.currentTimeMillis() / 1000
        if (expiresAt - nowSec > EARLY_REFRESH_SECONDS) return tokenStorage.accessToken()
        return refreshMutex.withLock {
            // 二次校验，避免并发多次刷新。
            val nowSec2 = System.currentTimeMillis() / 1000
            if (tokenStorage.expiresAt() - nowSec2 > EARLY_REFRESH_SECONDS) {
                return@withLock tokenStorage.accessToken()
            }
            doRefresh()
        }
    }

    private suspend fun doRefresh(): String? {
        val refreshToken = tokenStorage.refreshToken() ?: run {
            onRefreshFailed()
            return null
        }
        val result = runCatching {
            api.refresh(RefreshRequest(refreshToken = refreshToken))
        }
        val resp = result.getOrElse {
            onRefreshFailed()
            return null
        }
        tokenStorage.saveSession(
            accessToken = resp.accessToken,
            refreshToken = resp.refreshToken ?: refreshToken,
            expiresAt = resp.expiresAt,
            userId = tokenStorage.userId(),
            userEmail = tokenStorage.userEmail(),
        )
        return resp.accessToken
    }

    private suspend fun onRefreshFailed() {
        tokenStorage.clear()
        _state.value = AuthState.Unauthenticated
    }

    /**
     * 供 OkHttp TokenAuthenticator 同步取当前 access token（IO 线程 runBlocking）。
     */
    fun currentAccessToken(): String? = runBlocking { tokenStorage.accessToken() }

    companion object {
        /** 提前刷新窗口（秒），对齐 iOS 60s。 */
        const val EARLY_REFRESH_SECONDS: Long = 60L
    }
}
