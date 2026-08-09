package com.aistudy.app.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Assignment
import androidx.compose.material.icons.filled.BarChart
import androidx.compose.material.icons.filled.CameraAlt
import androidx.compose.material.icons.filled.Chat
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Sparkles
import androidx.compose.material.icons.outlined.Assignment
import androidx.compose.material.icons.outlined.BarChart
import androidx.compose.material.icons.outlined.CameraAlt
import androidx.compose.material.icons.outlined.Chat
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Home
import androidx.compose.material.icons.outlined.MenuBook
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Sparkles
import androidx.compose.ui.graphics.vector.ImageVector

/**
 * 导航目的地（镜像 iOS `SidebarItem`）。9 个目的地，与 iOS 完全对齐。
 */
enum class NavDestination(
    val route: String,
    val title: String,
    val selectedIcon: ImageVector,
    val unselectedIcon: ImageVector,
) {
    DASHBOARD("dashboard", "仪表盘", Icons.Filled.Home, Icons.Outlined.Home),
    CHAT("chat", "AI 学习助手", Icons.Filled.Chat, Icons.Outlined.Chat),
    ANALYZE("analyze", "题目分析", Icons.Filled.Search, Icons.Outlined.Search),
    UPLOAD("upload", "拍照分析", Icons.Filled.CameraAlt, Icons.Outlined.CameraAlt),
    GRADE("grade", "作业批改", Icons.Filled.CheckCircle, Icons.Outlined.CheckCircle),
    WRONG_QUESTIONS("wrong-questions", "错题复习", Icons.Filled.Assignment, Icons.Outlined.Assignment),
    STATS("stats", "学习统计", Icons.Filled.BarChart, Icons.Outlined.BarChart),
    PLAN("plan", "学习计划", Icons.Filled.Sparkles, Icons.Outlined.Sparkles),
    REAL_EXAM("real-exam", "真题演练", Icons.Filled.MenuBook, Icons.Outlined.MenuBook),
    ;

    companion object {
        val startDestination: NavDestination = DASHBOARD
        fun fromRoute(route: String?): NavDestination? = entries.firstOrNull { it.route == route }
    }
}
