package com.aistudy.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.PlanPriority
import com.aistudy.apicontracts.PlanResponse
import com.aistudy.apicontracts.PlanTask
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandPrimary

/** 学习计划屏（镜像 iOS `PlanView`）：学科 + focus → 任务列表（priority 着色）。 */
@Composable
fun PlanScreen(
    container: AppContainer,
    viewModel: PlanViewModel = viewModel(factory = PlanViewModel.factory(container)),
) {
    val subject by viewModel.subject.collectAsState()
    val focus by viewModel.focus.collectAsState()
    val plan by viewModel.plan.collectAsState()
    val isOffline by viewModel.isOffline.collectAsState()
    val showCachedBanner by viewModel.showCachedBanner.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("学习计划", style = MaterialTheme.typography.headlineSmall)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            viewModel.subjects.take(6).forEach { s ->
                AssistChip(
                    onClick = { viewModel.onSubjectChange(s) },
                    label = { Text(s) },
                    colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
                        containerColor = if (s == subject) brandPrimary else Color.Transparent,
                        labelColor = if (s == subject) Color.White else MaterialTheme.colorScheme.onSurface,
                    ),
                )
            }
        }

        OutlinedTextField(
            value = focus,
            onValueChange = viewModel::onFocusChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("重点（可选）") },
            placeholder = { Text("例如：函数与导数、立体几何") },
            singleLine = true,
            shape = RoundedCornerShape(12.dp),
        )

        Button(onClick = viewModel::generatePlan, modifier = Modifier.fillMaxWidth()) {
            Text("生成计划")
        }

        if (showCachedBanner) {
            Text("网络不可用，展示上次缓存计划", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        } else if (isOffline) {
            Text("网络不可用，且无本地缓存", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        when (val state = plan) {
            is LoadingState.Idle -> Unit
            is LoadingState.Loading -> Row { CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(8.dp)) }
            is LoadingState.Error -> Text(state.error.message ?: "生成失败", color = MaterialTheme.colorScheme.error)
            is LoadingState.Empty -> Unit
            is LoadingState.Loaded -> PlanContent(state.value)
        }
    }
}

@Composable
private fun PlanContent(plan: PlanResponse) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(plan.title, style = MaterialTheme.typography.titleMedium)
        Text(plan.description, style = MaterialTheme.typography.bodyMedium)
        plan.tasks.forEach { task -> PlanTaskCard(task) }
    }
}

@Composable
private fun PlanTaskCard(task: PlanTask) {
    val (badgeColor, badgeText) = when (task.priority) {
        PlanPriority.HIGH -> Color(0xFFDC2626) to "高"
        PlanPriority.MEDIUM -> Color(0xFFD97706) to "中"
        PlanPriority.LOW -> Color(0xFF16A34A) to "低"
    }
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = androidx.compose.ui.Alignment.CenterVertically) {
                Surface(color = badgeColor, shape = RoundedCornerShape(4.dp)) {
                    Text(badgeText, color = Color.White, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp))
                }
                Text(task.title, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
                Text("${task.estimatedMinutes} 分钟", style = MaterialTheme.typography.labelSmall)
            }
            Text("学科：${task.subject}", style = MaterialTheme.typography.bodySmall)
            if (task.knowledgePoints.isNotEmpty()) {
                Text("知识点：${task.knowledgePoints.joinToString("、")}", style = MaterialTheme.typography.bodySmall)
            }
            Text(task.reason, style = MaterialTheme.typography.bodySmall)
        }
    }
}
