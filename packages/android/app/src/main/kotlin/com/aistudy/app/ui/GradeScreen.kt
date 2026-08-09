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
import com.aistudy.apicontracts.GradeQuestionType
import com.aistudy.apicontracts.GradeResult
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandPrimary

/** 作业批改屏（镜像 iOS `GradeView`）。 */
@Composable
fun GradeScreen(
    container: AppContainer,
    viewModel: GradeViewModel = viewModel(factory = GradeViewModel.factory(container)),
) {
    val subject by viewModel.subject.collectAsState()
    val questionType by viewModel.questionType.collectAsState()
    val questionContent by viewModel.questionContent.collectAsState()
    val studentAnswer by viewModel.studentAnswer.collectAsState()
    val result by viewModel.result.collectAsState()
    val isOffline by viewModel.isOffline.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("作业批改", style = MaterialTheme.typography.headlineSmall)

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
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            GradeQuestionType.entries.forEach { t ->
                AssistChip(
                    onClick = { viewModel.onQuestionTypeChange(t) },
                    label = { Text(if (t == GradeQuestionType.MATH) "数学题" else "作文") },
                    colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
                        containerColor = if (t == questionType) brandPrimary else Color.Transparent,
                        labelColor = if (t == questionType) Color.White else MaterialTheme.colorScheme.onSurface,
                    ),
                )
            }
        }

        OutlinedTextField(
            value = questionContent,
            onValueChange = viewModel::onQuestionContentChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("题目内容") },
            placeholder = { Text("粘贴题目，至少10字") },
            minLines = 3,
            shape = RoundedCornerShape(12.dp),
        )
        OutlinedTextField(
            value = studentAnswer,
            onValueChange = viewModel::onStudentAnswerChange,
            modifier = Modifier.fillMaxWidth(),
            label = { Text("你的作答") },
            placeholder = { Text("输入你的解答") },
            minLines = 4,
            shape = RoundedCornerShape(12.dp),
        )

        Button(onClick = viewModel::submitForGrading, modifier = Modifier.fillMaxWidth()) {
            Text("提交批改")
        }

        if (isOffline) {
            Text("网络不可用，批改失败。请联网后重试。", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        when (val state = result) {
            is LoadingState.Idle -> Unit
            is LoadingState.Loading -> Row { CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(8.dp)) }
            is LoadingState.Error -> Text(state.error.message ?: "批改失败", color = MaterialTheme.colorScheme.error)
            is LoadingState.Empty -> Unit
            is LoadingState.Loaded -> GradeResultCard(state.value)
        }
    }
}

@Composable
private fun GradeResultCard(result: GradeResult) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            when (result) {
                is GradeResult.Math -> {
                    val m = result.data
                    Text("得分：${m.score} / ${m.maxScore}  ${if (m.isCorrect) "✓ 正确" else "✗ 有误"}", style = MaterialTheme.typography.titleMedium)
                    m.steps.forEach { step ->
                        Text("步骤 ${step.stepNumber} ${if (step.isCorrect) "✓" else "✗"}：${step.feedback}", style = MaterialTheme.typography.bodySmall)
                    }
                    Text("总结：${m.summary}", style = MaterialTheme.typography.bodyMedium)
                }
                is GradeResult.Essay -> {
                    val e = result.data
                    Text("得分：${e.score} / ${e.maxScore}", style = MaterialTheme.typography.titleMedium)
                    e.dimensions.forEach { (dim, score) ->
                        Text("$dim：$score", style = MaterialTheme.typography.bodySmall)
                    }
                    if (e.strengths.isNotEmpty()) {
                        Text("优点：${e.strengths.joinToString("；")}", style = MaterialTheme.typography.bodySmall)
                    }
                    if (e.weaknesses.isNotEmpty()) {
                        Text("不足：${e.weaknesses.joinToString("；")}", style = MaterialTheme.typography.bodySmall)
                    }
                    Text("总结：${e.summary}", style = MaterialTheme.typography.bodyMedium)
                }
            }
        }
    }
}
