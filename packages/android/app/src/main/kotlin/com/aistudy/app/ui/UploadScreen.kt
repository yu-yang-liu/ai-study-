package com.aistudy.app.ui

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import coil.compose.AsyncImage
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.AnalyzeResponse
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandPrimary

/** 拍照上传屏（镜像 iOS `UploadView`）：选图 → 上传 → 分析。 */
@Composable
fun UploadScreen(
    container: AppContainer,
    viewModel: UploadViewModel = viewModel(factory = UploadViewModel.factory(container)),
) {
    val context = LocalContext.current
    val selectedSubject by viewModel.selectedSubject.collectAsState()
    val imageUri by viewModel.imageUri.collectAsState()
    val uploadState by viewModel.uploadState.collectAsState()
    val analyzeState by viewModel.analyzeState.collectAsState()

    val picker = rememberLauncherForActivityResult(ActivityResultContracts.GetContent()) { uri: Uri? ->
        viewModel.setImage(uri)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("拍照上传", style = MaterialTheme.typography.headlineSmall)

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            viewModel.subjects.take(6).forEach { s ->
                AssistChip(
                    onClick = { viewModel.onSubjectChange(s) },
                    label = { Text(s) },
                    colors = androidx.compose.material3.AssistChipDefaults.assistChipColors(
                        containerColor = if (s == selectedSubject) brandPrimary else Color.Transparent,
                        labelColor = if (s == selectedSubject) Color.White else MaterialTheme.colorScheme.onSurface,
                    ),
                )
            }
        }

        if (imageUri != null) {
            Surface(shape = RoundedCornerShape(12.dp), modifier = Modifier.fillMaxWidth()) {
                AsyncImage(
                    model = imageUri,
                    contentDescription = "已选图片",
                    contentScale = ContentScale.FillWidth,
                    modifier = Modifier.fillMaxWidth().height(220.dp),
                )
            }
        }

        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = { picker.launch("image/*") }, modifier = Modifier.weight(1f)) {
                Text(imageUri?.let { "重选图片" } ?: "选择图片")
            }
            Button(
                onClick = { viewModel.upload(context) },
                enabled = imageUri != null && uploadState !is LoadingState.Loading,
                modifier = Modifier.weight(1f),
            ) { Text("上传") }
        }

        when (val state = uploadState) {
            is LoadingState.Loading -> Row { CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(8.dp)) }
            is LoadingState.Error -> Text(state.error.message ?: "上传失败", color = MaterialTheme.colorScheme.error)
            is LoadingState.Loaded -> {
                Text("上传成功，可开始分析", color = Color(0xFF16A34A), style = MaterialTheme.typography.bodySmall)
                Button(
                    onClick = viewModel::analyze,
                    enabled = analyzeState !is LoadingState.Loading,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text("开始分析") }
            }
            else -> Unit
        }

        when (val state = analyzeState) {
            is LoadingState.Loading -> Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(strokeWidth = 2.dp, modifier = Modifier.padding(8.dp))
            }
            is LoadingState.Error -> Text(state.error.message ?: "分析失败", color = MaterialTheme.colorScheme.error)
            is LoadingState.Loaded -> AnalyzeResultCard(state.value)
            else -> Unit
        }
    }
}

@Composable
private fun AnalyzeResultCard(response: AnalyzeResponse) {
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
            response.answer?.let {
                Text("参考答案", style = MaterialTheme.typography.titleSmall)
                Text(it, style = MaterialTheme.typography.bodyMedium)
            }
            Text("解析", style = MaterialTheme.typography.titleSmall)
            Text(response.analysis, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
