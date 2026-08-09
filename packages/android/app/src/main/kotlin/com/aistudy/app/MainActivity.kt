package com.aistudy.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import com.aistudy.app.ui.AppRoot
import com.aistudy.corekit.auth.AuthState
import com.aistudy.corekit.ui.BrandTheme

/**
 * 唯一 Activity（镜像 iOS `ContentView` 入口）。
 * 据 [AuthState] 在 splash / 登录 / 主界面间切换。
 */
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        val container = (application as AISLearningApp).container

        setContent {
            BrandTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    val authState by container.authManager.state.collectAsState()
                    when (authState) {
                        is AuthState.Loading -> com.aistudy.app.ui.SplashScreen()
                        is AuthState.Unauthenticated,
                        is AuthState.Error -> com.aistudy.app.ui.LoginScreen(container)
                        is AuthState.Authenticated -> AppRoot(container)
                    }
                }
            }
        }
    }
}
