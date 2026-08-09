package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.app.data.CodableChatMessage
import com.aistudy.apicontracts.AnalyzeRequest
import com.aistudy.apicontracts.ChatRequest
import com.aistudy.apicontracts.Subject
import com.aistudy.corekit.net.NetworkError
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID

/**
 * Chat ViewModel（镜像 iOS `ChatViewModel`）。
 *
 * - 学科选择 + quickChips（与 iOS 一致三条）。
 * - 拉服务端历史（`chatHistory`），失败 → Room 本地回退 + 离线 banner。
 * - 纯文本 → `/api/chat`；带图片 → upload → analyze（后端 runChatAgent 不接收 imageUrl，对齐 iOS P1-3）。
 * - action 卡片随助手消息携带，UI 按 `type` 分支渲染。
 */
class ChatViewModel(private val container: AppContainer) : ViewModel() {

    private val _messages = MutableStateFlow<LoadingState<List<ChatMessage>>>(LoadingState.Loaded(emptyList()))
    val messages: StateFlow<LoadingState<List<ChatMessage>>> = _messages.asStateFlow()

    private val _inputText = MutableStateFlow("")
    val inputText: StateFlow<String> = _inputText.asStateFlow()

    private val _selectedSubject = MutableStateFlow("数学")
    val selectedSubject: StateFlow<String> = _selectedSubject.asStateFlow()

    private val _isSending = MutableStateFlow(false)
    val isSending: StateFlow<Boolean> = _isSending.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    private var conversationId: String? = null
    private var currentTitle: String? = null

    val subjects: List<String> = Subject.entries.map { it.label }

    val quickChips: List<String> = listOf(
        "帮我制定今日学习计划",
        "我的薄弱点在哪里",
        "我有哪些待复习错题",
    )

    init { loadHistory() }

    fun onInputChange(value: String) { _inputText.value = value }
    fun onSubjectChange(value: String) {
        if (_selectedSubject.value != value) {
            _selectedSubject.value = value
            loadHistory()
        }
    }

    val canSend: Boolean
        get() = !_isSending.value && _inputText.value.isNotBlank()

    // MARK: - 历史加载

    fun loadHistory() {
        viewModelScope.launch {
            conversationId = null
            val result = runCatching {
                container.apiClient.api.chatHistory(subject = _selectedSubject.value)
            }
            result.onSuccess { response ->
                if (response.conversationId != null) {
                    conversationId = response.conversationId
                    val msgs = (response.messages ?: emptyList()).map { it.toChatMessage() }
                    _messages.value = if (msgs.isEmpty()) LoadingState.Loaded(emptyList()) else LoadingState.Loaded(msgs)
                    _isOffline.value = false
                    return@launch
                }
                val first = response.conversations?.firstOrNull()
                if (first != null) {
                    conversationId = first.id
                    val detail = runCatching {
                        container.apiClient.api.chatHistory(conversationId = first.id)
                    }.getOrNull()
                    val msgs = (detail?.messages ?: emptyList()).map { it.toChatMessage() }
                    _messages.value = if (msgs.isEmpty()) LoadingState.Loaded(emptyList()) else LoadingState.Loaded(msgs)
                    _isOffline.value = false
                    return@launch
                }
                _messages.value = LoadingState.Loaded(emptyList())
            }.onFailure { loadLocalFallback() }
        }
    }

    private suspend fun loadLocalFallback() {
        val histories = container.dataRepository.fetchChatHistories(limit = 1)
        val latest = histories.firstOrNull()
        if (latest == null) {
            _messages.value = LoadingState.Loaded(emptyList())
            return
        }
        val cached = container.dataRepository.fetchChatMessages(latest.title)
        currentTitle = latest.title
        _messages.value = LoadingState.Loaded(cached.map { ChatMessage(role = it.role, content = it.content, timestamp = it.timestamp) })
        _isOffline.value = true
    }

    // MARK: - 发送

    fun send(textOverride: String? = null) {
        val text = (textOverride ?: _inputText.value).trim()
        if (_isSending.value || text.isEmpty()) return

        _inputText.value = ""
        _isSending.value = true
        appendMessage(ChatMessage(role = "user", content = text))
        if (currentTitle == null) currentTitle = text.take(20)

        viewModelScope.launch {
            runCatching {
                val request = ChatRequest(subject = _selectedSubject.value, message = text, conversationId = conversationId)
                val response = container.apiClient.api.chat(request)
                if (response.conversationId != null) conversationId = response.conversationId
                ChatMessage(role = "assistant", content = response.reply, action = response.action)
            }.onSuccess { assistantMsg ->
                appendMessage(assistantMsg)
                persistCurrentChat()
                _isOffline.value = false
            }.onFailure { error ->
                _isOffline.value = error is NetworkError.NetworkUnavailable
                appendMessage(ChatMessage(role = "assistant", content = "发送失败：${error.message ?: "请稍后重试"}"))
            }
            _isSending.value = false
        }
    }

    private fun appendMessage(message: ChatMessage) {
        val current = (_messages.value as? LoadingState.Loaded)?.value ?: emptyList()
        _messages.value = LoadingState.Loaded(current + message)
    }

    private suspend fun persistCurrentChat() {
        val title = currentTitle ?: return
        val current = (_messages.value as? LoadingState.Loaded)?.value ?: emptyList()
        val codable = current.map { CodableChatMessage(role = it.role, content = it.content, timestamp = it.timestamp) }
        container.dataRepository.saveChatHistory(title = title, subject = _selectedSubject.value, messages = codable)
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = ChatViewModel(container) as T
            }
    }
}

/** UI 侧消息（镜像 iOS `ChatMessage`）。 */
data class ChatMessage(
    val id: String = UUID.randomUUID().toString(),
    val role: String,        // "user" | "assistant"
    val content: String,
    val timestamp: Long = System.currentTimeMillis(),
    val action: com.aistudy.apicontracts.ChatActionPayload? = null,
)

private fun com.aistudy.apicontracts.ChatHistoryMessage.toChatMessage(): ChatMessage =
    ChatMessage(role = role, content = content)
