package com.aistudy.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Sparkles
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aistudy.app.AppContainer
import com.aistudy.corekit.config.AppEnvironment
import com.aistudy.corekit.config.FeatureFlags
import com.aistudy.corekit.ui.brandAccent
import com.aistudy.corekit.ui.brandPrimary

/**
 * 仪表盘（镜像 iOS `DashboardView`）：倒计时卡 + AI 学习助手 CTA + AI 计划卡 + 2x2 工具格 + 题库数。
 */
@Composable
fun DashboardScreen(
    container: AppContainer,
    onNavigate: (NavDestination) -> Unit,
    viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.factory(container)),
) {
    val daysRemaining by viewModel.daysRemaining.collectAsState()
    val bankCount by viewModel.bankCount.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        CountdownCard(daysRemaining = daysRemaining)
        AssistantCta(onClick = { onNavigate(NavDestination.CHAT) })
        AiPlanCard(onClick = { onNavigate(NavDestination.PLAN) })
        QuickToolsGrid(onNavigate = onNavigate, bankCount = bankCount)
    }
}

@Composable
private fun CountdownCard(daysRemaining: Int) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .background(brandPrimary, RoundedCornerShape(24.dp))
            .padding(20.dp),
    ) {
        Text(
            "距离${if (AppEnvironment.phase == "high") "高考" else "中考"}还有",
            color = Color.White.copy(alpha = 0.7f),
            style = MaterialTheme.typography.bodyMedium,
        )
        Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(
                "$daysRemaining",
                color = Color.White,
                style = MaterialTheme.typography.displayLarge.copy(fontWeight = FontWeight.Black),
            )
            Text("天", color = Color.White.copy(alpha = 0.5f), style = MaterialTheme.typography.titleLarge)
        }
        Text(
            "行百里者半九十，坚持就是胜利",
            color = Color.White.copy(alpha = 0.4f),
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun AssistantCta(onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .background(
                Brush.linearGradient(listOf(brandPrimary, brandPrimary.copy(alpha = 0.85f))),
                RoundedCornerShape(24.dp),
            )
            .padding(18.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(Icons.Filled.Sparkles, contentDescription = null, tint = Color.White)
            Text("AI 学习助手", color = Color.White, style = MaterialTheme.typography.titleMedium)
        }
        Spacer(Modifier.height(4.dp))
        Text("懂你的学情，可制定计划、查错题、批改作业", color = Color.White.copy(alpha = 0.85f), style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(12.dp))
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .background(Color.White, RoundedCornerShape(12.dp))
                .padding(vertical = 10.dp),
            contentAlignment = Alignment.Center,
        ) {
            Text("开始对话", color = brandPrimary, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun AiPlanCard(onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
        colors = CardDefaults.cardColors(),
    ) {
        Column(modifier = Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Icon(Icons.Filled.Sparkles, contentDescription = null, tint = MaterialTheme.colorScheme.secondary)
                Text("AI 定制提分计划", style = MaterialTheme.typography.titleMedium)
            }
            Spacer(Modifier.height(4.dp))
            Text("基于学情数据，AI 为你生成本日突破任务", style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(12.dp))
            Box(
                modifier = Modifier
                    .fillMaxWidth()
                    .background(brandPrimary, RoundedCornerShape(12.dp))
                    .padding(vertical = 12.dp),
                contentAlignment = Alignment.Center,
            ) {
                Text("点击生成", color = Color.White, fontWeight = FontWeight.Bold)
            }
        }
    }
}

private data class QuickTool(val destination: NavDestination, val title: String, val subtitle: String)

@Composable
private fun QuickToolsGrid(onNavigate: (NavDestination) -> Unit, bankCount: Int?) {
    val tools = buildList {
        if (FeatureFlags.isChatEnabled) add(QuickTool(NavDestination.CHAT, "AI 学习助手", "自由交流答疑"))
        if (FeatureFlags.isAnalyzeEnabled) add(QuickTool(NavDestination.ANALYZE, "题目分析", "深度解析题干"))
        if (FeatureFlags.isUploadEnabled) add(QuickTool(NavDestination.UPLOAD, "拍照分析", "上传题目图片"))
        if (FeatureFlags.isGradeEnabled) add(QuickTool(NavDestination.GRADE, "作业批改", "智能评分反馈"))
        if (FeatureFlags.isWrongQuestionsEnabled) add(QuickTool(NavDestination.WRONG_QUESTIONS, "错题复习", "SM-2 间隔复习"))
        if (FeatureFlags.isStatsEnabled) add(QuickTool(NavDestination.STATS, "学习统计", "数据总览分析"))
        add(QuickTool(NavDestination.REAL_EXAM, "真题演练", "近十年真题库"))
    }
    Text("智能备考工具", style = MaterialTheme.typography.titleMedium, modifier = Modifier.padding(start = 4.dp))
    LazyVerticalGrid(
        columns = GridCells.Fixed(2),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier.height(((tools.size + 1) / 2 * 160).dp),
    ) {
        items(tools) { tool -> ToolCard(title = tool.title, subtitle = tool.subtitle, onClick = { onNavigate(tool.destination) }) }
        item {
            BankCountCard(bankCount)
        }
    }
}

@Composable
private fun ToolCard(title: String, subtitle: String, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .height(150.dp)
            .clickable(onClick = onClick),
        shape = RoundedCornerShape(24.dp),
    ) {
        Column(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Box(
                modifier = Modifier
                    .size(48.dp)
                    .background(Color.Black.copy(alpha = 0.04f), RoundedCornerShape(16.dp)),
                contentAlignment = Alignment.Center,
            ) {
                Icon(Icons.Filled.Sparkles, contentDescription = null, tint = brandAccent)
            }
            Spacer(Modifier.height(8.dp))
            Text(title, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
            Text(subtitle, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.secondary)
        }
    }
}

@Composable
private fun BankCountCard(bankCount: Int?) {
    Card(
        modifier = Modifier.height(150.dp),
        shape = RoundedCornerShape(24.dp),
    ) {
        Column(
            modifier = Modifier
                .padding(12.dp)
                .fillMaxSize(),
            verticalArrangement = Arrangement.Center,
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text("题库总数", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.secondary)
            Text(
                bankCount?.toString() ?: "—",
                style = MaterialTheme.typography.displaySmall.copy(fontWeight = FontWeight.Bold),
            )
        }
    }
}
