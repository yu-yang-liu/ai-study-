package com.aistudy.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import com.aistudy.app.AppContainer
import com.aistudy.corekit.config.FeatureFlags

/**
 * 应用根（镜像 iOS `ContentView`）：已登录后挂载主壳 [MainScaffold]。
 * 未登录 / 加载态已在 [com.aistudy.app.MainActivity] 据 AuthState 分流，故此处只处理已认证。
 */
@Composable
fun AppRoot(container: AppContainer) {
    MainScaffold(container = container)
}
