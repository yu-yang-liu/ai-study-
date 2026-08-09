package com.aistudy.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
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
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandPrimary

/** 题目分析屏（镜像 iOS `AnalyzeView` + `AnalysisResultView`）。 */
@Composable
fun AnalyzeScreen(
    container: AppContainer,
    viewModel: AnalyzeViewModel = viewModel(factory = AnalyzeViewModel.factory(container)),
) {
    val content by viewModel.content.collectAsState()
    val selectedSubject by viewModel.selectedSubject.collectAsState()
    val result by viewModel.result.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("题目分析", style = MaterialTheme.typography.headlineSmall)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            viewModel.subjects.take(6).forEach { subject ->
                AssistChip(
                    onClick = { viewModel.onSubjectChange(subject) },
                    label = { Text(subject) },
                    colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
                        containerColor = if (subject == selectedSubject) brandPrimary else Color.Transparent,
                        labelColor = if (subject == selectedSubject) Color.White else MaterialTheme.colorScheme.onSurface,
                    ),
                )
            }
        }

        OutlinedTextField(
            value = content,
            onValueChange = viewModel::onContentChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("题目内容") },
            placeholder = { Text("粘贴或输入题目，至少10字") },
            minLines = 4,
            shape = RoundedCornerShape(12.dp),
        )

        Button(onClick = viewModel::analyze, modifier = Modifier.fillMaxWidth()) {
            Text("开始分析")
        }

        when (val state = result) {
            is LoadingState.Idle -> Unit
            is LoadingState.Loading -> Row { CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(8.dp)) }
            is LoadingState.Error -> Text(state.error.message ?: "分析失败", color = MaterialTheme.colorScheme.error)
            is LoadingState.Empty -> Unit
            is LoadingState.Loaded -> AnalyzeResultCard(state.value)
        }
    }
}

@Composable
private fun AnalyzeResultCard(response: com.aistudy.apicontracts.AnalyzeResponse) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("学科：${response.subject} · ${response.questionType}", style = MaterialTheme.typography.labelLarge)
            Text("难度：${response.difficulty}", style = MaterialTheme.typography.bodyMedium)
            if (response.knowledgePoints.isNotEmpty()) {
                Text("知识点：${response.knowledgePoints.joinToString("、")}", style = MaterialTheme.typography.bodySmall)
            }
            if (response.examPoints.isNotEmpty()) {
                Text("考点：${response.examPoints.joinToString("、")}", style = MaterialTheme.typography.bodySmall)
            }
            if (response.answer != null) {
                Text("参考答案", style = MaterialTheme.typography.titleSmall)
                Text(response.answer, style = MaterialTheme.typography.bodyMedium)
            }
            Text("解析", style = MaterialTheme.typography.titleSmall)
            Text(response.analysis, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
