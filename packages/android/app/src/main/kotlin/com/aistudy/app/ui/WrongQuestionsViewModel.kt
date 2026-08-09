package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.ReviewWrongQuestionRequest
import com.aistudy.apicontracts.WrongQuestionItem
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.OffsetDateTime

/**
 * 错题复习 ViewModel（镜像 iOS `WrongQuestionsViewModel`）。
 * 拉列表 → 拆 due/upcoming（`nextReviewAt` ≤ now）；SM-2 review → 本地移除。
 */
class WrongQuestionsViewModel(private val container: AppContainer) : ViewModel() {

    private val _questions = MutableStateFlow<LoadingState<List<WrongQuestionItem>>>(LoadingState.Idle)
    val questions: StateFlow<LoadingState<List<WrongQuestionItem>>> = _questions.asStateFlow()

    private val _actionError = MutableStateFlow<String?>(null)
    val actionError: StateFlow<String?> = _actionError.asStateFlow()

    val dueQuestions: List<WrongQuestionItem>
        get() = (_questions.value as? LoadingState.Loaded)?.value?.filter { isDue(it) }.orEmpty()

    val upcomingQuestions: List<WrongQuestionItem>
        get() = (_questions.value as? LoadingState.Loaded)?.value?.filter { !isDue(it) }.orEmpty()

    fun load() {
        viewModelScope.launch {
            _questions.value = LoadingState.Loading
            val result = runCatching { container.apiClient.api.wrongQuestions().questions }
            result.onSuccess { items ->
                _questions.value = if (items.isEmpty()) LoadingState.Empty else LoadingState.Loaded(items)
            }.onFailure { _questions.value = LoadingState.Error(it) }
        }
    }

    fun review(id: String, quality: Int) {
        viewModelScope.launch {
            _actionError.value = null
            val result = runCatching {
                container.apiClient.api.reviewWrong(ReviewWrongQuestionRequest(id = id, quality = quality))
            }
            result.onSuccess {
                val current = (_questions.value as? LoadingState.Loaded)?.value ?: return@onSuccess
                val updated = current.filterNot { item -> item.id == id }
                _questions.value = if (updated.isEmpty()) LoadingState.Empty else LoadingState.Loaded(updated)
            }.onFailure { error -> _actionError.value = error.message ?: "复习评分提交失败" }
        }
    }

    private fun isDue(item: WrongQuestionItem): Boolean {
        if (item.nextReviewAt.isEmpty()) return true
        val instant = parseIso(item.nextReviewAt) ?: return true
        return !instant.isAfter(Instant.now())
    }

    /** 解析 ISO-8601（带偏移优先，再回退到 UTC Instant），失败返回 null。 */
    private fun parseIso(text: String): Instant? = runCatching {
        OffsetDateTime.parse(text).toInstant()
    }.recoverCatching {
        Instant.parse(text)
    }.getOrNull()

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = WrongQuestionsViewModel(container) as T
            }
    }
}
