package com.aistudy.app

import android.app.Application
import com.aistudy.app.data.AiStudyDatabase
import com.aistudy.app.data.DataRepository
import com.aistudy.corekit.auth.AuthManager
import com.aistudy.corekit.auth.TokenStorage
import com.aistudy.corekit.config.AppEnvironment
import com.aistudy.corekit.net.ApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * 应用入口（镜像 iOS `iOSApp.swift` + `AppCoordinator`）。
 *
 * 装配依赖图：TokenStorage → ApiClient → AuthManager → Room → DataRepository，
 * 供 ViewModelFactory 注入。BuildConfig.API_BASE_URL 注入 AppEnvironment（对齐 iOS Info.plist）。
 */
class AISLearningApp : Application() {

    lateinit var container: AppContainer
        private set

    override fun onCreate() {
        super.onCreate()
        // 注入 API 基址（debug/release 由 BuildConfig 区分）。
        AppEnvironment.configure(BuildConfig.API_BASE_URL)

        container = AppContainer(this)
        // 启动时恢复会话（不阻塞主线程；UI 据 state 切换）。
        container.appScope.launch {
            container.authManager.restoreSession()
        }
    }
}

/**
 * 依赖容器（轻量手写 DI，对齐 iOS AppCoordinator 持有的各服务实例）。
 */
class AppContainer(private val context: android.content.Context) {

    val appScope: CoroutineScope = CoroutineScope(SupervisorJob() + Dispatchers.Default)

    val tokenStorage: TokenStorage = TokenStorage(context)

    val apiClient: ApiClient by lazy {
        ApiClient.create(
            tokenStorage = tokenStorage,
            authManager = authManager,
            debug = BuildConfig.DEBUG,
        )
    }

    val authManager: AuthManager by lazy {
        AuthManager(tokenStorage = tokenStorage, api = apiClient.api)
    }

    val database: AiStudyDatabase by lazy {
        AiStudyDatabase.create(context)
    }

    val dataRepository: DataRepository by lazy {
        DataRepository(database)
    }
}
