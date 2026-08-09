package com.aistudy.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Send
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
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
import com.aistudy.corekit.ui.LoadingState
import com.aistudy.corekit.ui.brandAccent
import com.aistudy.corekit.ui.brandPrimary
import dev.jeziellago.compose.markdowntext.MarkdownText

/** Chat 屏（镜像 iOS `ChatView`）：学科切换 + quickChips + 消息流 + 输入栏。 */
@Composable
fun ChatScreen(
    container: AppContainer,
    viewModel: ChatViewModel = viewModel(factory = ChatViewModel.factory(container)),
) {
    val messages by viewModel.messages.collectAsState()
    val inputText by viewModel.inputText.collectAsState()
    val isSending by viewModel.isSending.collectAsState()
    val isOffline by viewModel.isOffline.collectAsState()
    val selectedSubject by viewModel.selectedSubject.collectAsState()
    val listState = rememberLazyListState()

    val list = (messages as? LoadingState.Loaded)?.value ?: emptyList()
    LaunchedEffect(list.size) {
        if (list.isNotEmpty()) listState.animateScrollToItem(list.size - 1)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        if (isOffline) {
            Surface(color = MaterialTheme.colorScheme.errorContainer, modifier = Modifier.fillMaxWidth()) {
                Text(
                    "离线模式：展示本地缓存对话，联网后自动恢复",
                    modifier = Modifier.padding(8.dp),
                    style = MaterialTheme.typography.bodySmall,
                )
            }
        }

        // 学科切换 + quickChips
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            viewModel.subjects.take(5).forEach { subject ->
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
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            viewModel.quickChips.forEach { chip ->
                AssistChip(onClick = { viewModel.send(chip) }, label = { Text(chip, style = MaterialTheme.typography.bodySmall) })
            }
        }

        HorizontalDivider()

        // 消息流
        LazyColumn(
            state = listState,
            modifier = Modifier
                .weight(1f)
                .fillMaxWidth()
                .padding(horizontal = 12.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(vertical = 12.dp),
        ) {
            items(list) { msg -> MessageBubble(msg) }
            if (isSending) {
                item {
                    Box(modifier = Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        CircularProgressIndicator(modifier = Modifier.height(24.dp), strokeWidth = 2.dp)
                    }
                }
            }
        }

        // 输入栏
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .padding(12.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            OutlinedTextField(
                value = inputText,
                onValueChange = viewModel::onInputChange,
                modifier = Modifier.weight(1f),
                placeholder = { Text("问点什么…") },
                maxLines = 4,
                shape = RoundedCornerShape(20.dp),
            )
            IconButton(onClick = viewModel::send, enabled = viewModel.canSend) {
                Icon(Icons.AutoMirrored.Filled.Send, contentDescription = "发送", tint = brandAccent)
            }
        }
    }
}

@Composable
private fun MessageBubble(message: ChatMessage) {
    val isUser = message.role == "user"
    Column(
        modifier = Modifier.fillMaxWidth(),
        horizontalAlignment = if (isUser) Alignment.End else Alignment.Start,
    ) {
        Surface(
            color = if (isUser) brandPrimary else MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(16.dp),
        ) {
            // 助手消息用 Markdown 渲染（标题/列表/代码块）；用户消息保持纯文本（对齐 iOS）。
            if (isUser) {
                Text(
                    text = message.content,
                    color = Color.White,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                )
            } else {
                MarkdownText(
                    markdown = message.content,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 8.dp),
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        }
        message.action?.let { action ->
            Spacer(Modifier.height(4.dp))
            ActionCard(action)
        }
    }
}

@Composable
private fun ActionCard(action: com.aistudy.apicontracts.ChatActionPayload) {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(12.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(12.dp)) {
            Text("AI 卡片 · ${action.type}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Spacer(Modifier.height(4.dp))
            Text(action.payload.toString(), style = MaterialTheme.typography.bodySmall)
        }
    }
}
