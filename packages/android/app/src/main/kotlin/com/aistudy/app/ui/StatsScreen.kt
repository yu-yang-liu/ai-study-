package com.aistudy.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.StatsResponse
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandPrimary

/** 学习统计屏（镜像 iOS `StatsView`）：总题数/错数/准确率/均分 + 学科分布 + 近期活动。 */
@Composable
fun StatsScreen(
    container: AppContainer,
    viewModel: StatsViewModel = viewModel(factory = StatsViewModel.factory(container)),
) {
    val stats by viewModel.stats.collectAsState()
    LaunchedEffect(Unit) { viewModel.load() }

    PullToRefreshBox(
        isRefreshing = stats is LoadingState.Loading,
        onRefresh = viewModel::load,
        modifier = Modifier.fillMaxSize(),
    ) {
        Column(
            modifier = Modifier
                .fillMaxSize()
                .verticalScroll(rememberScrollState())
                .padding(16.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            Text("学习统计", style = MaterialTheme.typography.headlineSmall)

            when (val state = stats) {
                is LoadingState.Idle -> Unit
                is LoadingState.Loading -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(16.dp))
                }
                is LoadingState.Empty -> Text("暂无统计数据。", style = MaterialTheme.typography.bodyMedium)
                is LoadingState.Error -> Column {
                    Text(state.error.message ?: "加载失败", color = MaterialTheme.colorScheme.error)
                    Button(onClick = viewModel::load) { Text("重试") }
                }
                is LoadingState.Loaded -> StatsContent(state.value)
            }
        }
    }
}

@Composable
private fun StatsContent(stats: StatsResponse) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MetricCard("总题数", stats.totalQuestions.toString(), Modifier.weight(1f))
        MetricCard("错题数", stats.totalWrong.toString(), Modifier.weight(1f))
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        MetricCard("准确率", "${"%.1f".format(stats.accuracy * 100)}%", Modifier.weight(1f))
        MetricCard("平均分", "%.1f".format(stats.avgScore), Modifier.weight(1f))
    }

    if (stats.subjectBreakdown.isNotEmpty()) {
        Text("学科分布", style = MaterialTheme.typography.titleMedium)
        stats.subjectBreakdown.forEach { (subject, item) ->
            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                Row(modifier = Modifier.padding(12.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(subject, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Text("对 ${item.correct} · 错 ${item.wrong}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text("均分 ${"%.1f".format(item.avgScore)}", style = MaterialTheme.typography.bodySmall, color = brandPrimary, modifier = Modifier.padding(start = 12.dp))
                }
            }
        }
    }

    if (stats.recentActivity.isNotEmpty()) {
        Text("近期活动", style = MaterialTheme.typography.titleMedium)
        stats.recentActivity.forEach { item ->
            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = RoundedCornerShape(10.dp), modifier = Modifier.fillMaxWidth()) {
                Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(item.date.take(10), style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(1f))
                    Text("${item.count} 题", style = MaterialTheme.typography.bodySmall, color = Color(0xFF64748B))
                }
            }
        }
    }
}

@Composable
private fun MetricCard(label: String, value: String, modifier: Modifier = Modifier) {
    Surface(color = brandPrimary, shape = RoundedCornerShape(16.dp), modifier = modifier) {
        Column(modifier = Modifier.padding(16.dp), horizontalAlignment = Alignment.CenterHorizontally) {
            Text(value, color = Color.White, style = MaterialTheme.typography.headlineMedium)
            Text(label, color = Color.White.copy(alpha = 0.8f), style = MaterialTheme.typography.labelMedium)
        }
    }
}
