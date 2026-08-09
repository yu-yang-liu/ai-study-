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
import androidx.compose.material3.OutlinedButton
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
import com.aistudy.apicontracts.WrongQuestionItem
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandPrimary

/** 错题复习屏（镜像 iOS `WrongQuestionsView`）：待复习 / 计划中 + SM-2 自评。 */
@Composable
fun WrongQuestionsScreen(
    container: AppContainer,
    viewModel: WrongQuestionsViewModel = viewModel(factory = WrongQuestionsViewModel.factory(container)),
) {
    val questions by viewModel.questions.collectAsState()
    val actionError by viewModel.actionError.collectAsState()

    LaunchedEffect(Unit) { viewModel.load() }

    PullToRefreshBox(
        isRefreshing = questions is LoadingState.Loading,
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
            Text("错题复习", style = MaterialTheme.typography.headlineSmall)

            actionError?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }

            when (val state = questions) {
                is LoadingState.Idle -> Unit
                is LoadingState.Loading -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                    CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(16.dp))
                }
                is LoadingState.Empty -> Text("暂无错题记录。完成批改后，错题会自动汇集到这里。", style = MaterialTheme.typography.bodyMedium)
                is LoadingState.Error -> Column {
                    Text(state.error.message ?: "加载失败", color = MaterialTheme.colorScheme.error)
                    Button(onClick = viewModel::load) { Text("重试") }
                }
                is LoadingState.Loaded -> {
                    val due = viewModel.dueQuestions
                    val upcoming = viewModel.upcomingQuestions
                    if (due.isNotEmpty()) {
                        SectionHeader("待复习", due.size)
                        due.forEach { DueCard(it, viewModel::review) }
                    }
                    if (upcoming.isNotEmpty()) {
                        SectionHeader("计划中", upcoming.size)
                        upcoming.take(5).forEach { UpcomingRow(it) }
                    }
                    if (due.isEmpty() && upcoming.isEmpty()) {
                        Text("暂无错题记录。", style = MaterialTheme.typography.bodyMedium)
                    }
                }
            }
        }
    }
}

@Composable
private fun SectionHeader(title: String, count: Int) {
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Text("$count 道", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun DueCard(item: WrongQuestionItem, onReview: (id: String, quality: Int) -> Unit) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SubjectPill(item.subject)
                if (item.knowledgePoint.isNotEmpty()) {
                    Text(item.knowledgePoint, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
                Text("第 ${item.sm2Interval} 次复习", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
            }
            Text(item.questionContent, style = MaterialTheme.typography.bodyMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                AnswerBox("你的作答", item.studentAnswer, Color(0x14DC2626), Color(0xFFDC2626))
                AnswerBox("正确答案", item.correctAnswer, Color(0x1416A34A), Color(0xFF16A34A))
            }
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                ReviewButton("完全忘了", 0, prominent = false) { onReview(item.id, 0) }
                ReviewButton("有点印象", 2, prominent = false) { onReview(item.id, 2) }
                ReviewButton("基本掌握", 3, prominent = false) { onReview(item.id, 3) }
                ReviewButton("完全掌握", 5, prominent = true) { onReview(item.id, 5) }
            }
        }
    }
}

@Composable
private fun SubjectPill(subject: String) {
    Surface(color = brandPrimary, shape = RoundedCornerShape(8.dp)) {
        Text(subject, color = Color.White, style = MaterialTheme.typography.labelSmall, modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp))
    }
}

@Composable
private fun AnswerBox(title: String, text: String, background: Color, foreground: Color) {
    Surface(color = background, shape = RoundedCornerShape(8.dp), modifier = Modifier.weight(1f)) {
        Column(modifier = Modifier.padding(8.dp)) {
            Text(title, style = MaterialTheme.typography.labelSmall, color = foreground.copy(alpha = 0.7f))
            Text(text.ifEmpty { "—" }, style = MaterialTheme.typography.bodySmall, color = foreground)
        }
    }
}

@Composable
private fun ReviewButton(label: String, quality: Int, prominent: Boolean, onClick: () -> Unit) {
    if (prominent) {
        Button(onClick = onClick, modifier = Modifier.weight(1f)) { Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) }
    } else {
        OutlinedButton(onClick = onClick, modifier = Modifier.weight(1f)) { Text(label, style = MaterialTheme.typography.labelSmall, maxLines = 1) }
    }
}

@Composable
private fun UpcomingRow(item: WrongQuestionItem) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(10.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${item.subject} · ${item.knowledgePoint.ifEmpty { "错题" }}",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.weight(1f),
            )
            Text(item.nextReviewAt.take(10), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
    }
}
