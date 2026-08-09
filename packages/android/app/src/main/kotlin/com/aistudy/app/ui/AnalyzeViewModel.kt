package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.AnalyzeRequest
import com.aistudy.apicontracts.Subject
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 题目分析 ViewModel（镜像 iOS `AnalyzeViewModel`）。content ≥ 10 字校验。 */
class AnalyzeViewModel(private val container: AppContainer) : ViewModel() {

    private val _content = MutableStateFlow("")
    val content: StateFlow<String> = _content.asStateFlow()

    private val _selectedSubject = MutableStateFlow("数学")
    val selectedSubject: StateFlow<String> = _selectedSubject.asStateFlow()

    private val _result = MutableStateFlow<LoadingState<com.aistudy.apicontracts.AnalyzeResponse>>(LoadingState.Idle)
    val result: StateFlow<LoadingState<com.aistudy.apicontracts.AnalyzeResponse>> = _result.asStateFlow()

    val subjects: List<String> = Subject.entries.map { it.label }

    fun onContentChange(value: String) { _content.value = value }
    fun onSubjectChange(value: String) { _selectedSubject.value = value }

    fun analyze() {
        val text = _content.value.trim()
        if (text.length < 10) {
            _result.value = LoadingState.Error(IllegalArgumentException("请输入至少10个字的题目内容"))
            return
        }
        viewModelScope.launch {
            _result.value = LoadingState.Loading
            _result.value = runCatching {
                container.apiClient.api.analyze(AnalyzeRequest(content = text, subject = _selectedSubject.value))
            }.fold(onSuccess = { LoadingState.Loaded(it) }, onFailure = { LoadingState.Error(it) })
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = AnalyzeViewModel(container) as T
            }
    }
}
