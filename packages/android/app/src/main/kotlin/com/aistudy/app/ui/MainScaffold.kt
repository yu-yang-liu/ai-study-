package com.aistudy.app.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.adaptive.navigationsuite.NavigationSuiteScaffold
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavGraph.Companion.findStartDestination
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.aistudy.app.AppContainer
import com.aistudy.corekit.config.FeatureFlags

/**
 * 主壳（镜像 iOS `NavigationSplitView` sidebar+detail）。
 * [NavigationSuiteScaffold] 自适应：平板/展开态显示侧栏，手机显示底栏。
 * [NavHost] 承载 9 个目的地，按 [NavDestination] 路由切换。
 * AppBar 右侧头像入口以 ModalBottomSheet 打开 [ProfileScreen]（对齐 iOS sidebar 底部用户区 sheet）。
 */
@Composable
fun MainScaffold(container: AppContainer) {
    val navController = rememberNavController()
    val backStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = backStackEntry?.destination?.route

    var showProfileSheet by rememberSaveable { mutableStateOf(false) }

    val navigateTo: (NavDestination) -> Unit = { dest ->
        navController.navigate(dest.route) {
            // 弹到起点避免栈堆积，保留状态（对齐 iOS 单 detail 替换语义）。
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    NavigationSuiteScaffold(
        navigationSuiteItems = {
            NavDestination.entries.forEach { dest ->
                val selected = currentRoute == dest.route
                item(
                    selected = selected,
                    onClick = { navigateTo(dest) },
                    icon = {
                        Icon(
                            imageVector = if (selected) dest.selectedIcon else dest.unselectedIcon,
                            contentDescription = dest.title,
                        )
                    },
                    label = { Text(dest.title) },
                )
            }
        },
    ) {
        Scaffold(
            topBar = {
                // 轻量顶部栏：标题 + 右侧「我的」入口（对齐 iOS detail 顶栏）。
                NavDestination.fromRoute(currentRoute)?.let { dest ->
                    AppBar(
                        title = dest.title,
                        onProfileClick = { showProfileSheet = true },
                    )
                }
            },
        ) { innerPadding ->
            NavHost(
                navController = navController,
                startDestination = NavDestination.startDestination.route,
                modifier = Modifier
                    .fillMaxSize()
                    .padding(innerPadding),
            ) {
                featureDestinations(container, navController)
            }
        }
    }

    if (showProfileSheet) {
        val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(
            onDismissRequest = { showProfileSheet = false },
            sheetState = sheetState,
        ) {
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .verticalScroll(rememberScrollState()),
            ) {
                ProfileScreen(container = container)
            }
        }
    }
}

/** NavHost 9 目的地注册（与 [NavDestination] 一一对应）。 */
private fun androidx.navigation.NavGraphBuilder.featureDestinations(
    container: AppContainer,
    navController: NavHostController,
) {
    val navigateTo: (NavDestination) -> Unit = { dest ->
        navController.navigate(dest.route) {
            popUpTo(navController.graph.findStartDestination().id) { saveState = true }
            launchSingleTop = true
            restoreState = true
        }
    }

    composable(NavDestination.DASHBOARD.route) {
        DashboardScreen(container = container, onNavigate = navigateTo)
    }
    composable(NavDestination.CHAT.route) {
        if (FeatureFlags.isChatEnabled) ChatScreen(container = container)
        else FeatureDisabledPlaceholder("AI 学习助手")
    }
    composable(NavDestination.ANALYZE.route) {
        if (FeatureFlags.isAnalyzeEnabled) AnalyzeScreen(container = container)
        else FeatureDisabledPlaceholder("题目分析")
    }
    composable(NavDestination.UPLOAD.route) {
        if (FeatureFlags.isUploadEnabled) UploadScreen(container = container)
        else FeatureDisabledPlaceholder("拍照分析")
    }
    composable(NavDestination.GRADE.route) {
        if (FeatureFlags.isGradeEnabled) GradeScreen(container = container)
        else FeatureDisabledPlaceholder("作业批改")
    }
    composable(NavDestination.WRONG_QUESTIONS.route) {
        if (FeatureFlags.isWrongQuestionsEnabled) WrongQuestionsScreen(container = container)
        else FeatureDisabledPlaceholder("错题复习")
    }
    composable(NavDestination.STATS.route) {
        if (FeatureFlags.isStatsEnabled) StatsScreen(container = container)
        else FeatureDisabledPlaceholder("学习统计")
    }
    composable(NavDestination.PLAN.route) {
        PlanScreen(container = container)
    }
    composable(NavDestination.REAL_EXAM.route) {
        RealExamPlaceholder(container = container)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AppBar(title: String, onProfileClick: () -> Unit = {}) {
    TopAppBar(
        title = { Text(title, style = MaterialTheme.typography.titleLarge) },
        actions = {
            IconButton(onClick = onProfileClick) {
                Icon(Icons.Filled.AccountCircle, contentDescription = "我的")
            }
        },
    )
}

@Composable
private fun FeatureDisabledPlaceholder(name: String) {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center,
    ) {
        Text("$name 暂未开放", style = MaterialTheme.typography.bodyLarge)
    }
}
