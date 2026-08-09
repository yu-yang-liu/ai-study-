package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.PlanRequest
import com.aistudy.apicontracts.PlanResponse
import com.aistudy.apicontracts.Subject
import com.aistudy.corekit.net.ApiClient
import com.aistudy.corekit.net.NetworkError
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 学习计划 ViewModel（镜像 iOS `PlanViewModel`）。
 * POST /api/plan → 任务列表；成功落 Room 缓存；网络失败 → 读缓存 + 离线 banner。
 */
class PlanViewModel(private val container: AppContainer) : ViewModel() {

    private val _subject = MutableStateFlow("数学")
    val subject: StateFlow<String> = _subject.asStateFlow()

    private val _focus = MutableStateFlow("")
    val focus: StateFlow<String> = _focus.asStateFlow()

    private val _plan = MutableStateFlow<LoadingState<PlanResponse>>(LoadingState.Idle)
    val plan: StateFlow<LoadingState<PlanResponse>> = _plan.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    private val _showCachedBanner = MutableStateFlow(false)
    val showCachedBanner: StateFlow<Boolean> = _showCachedBanner.asStateFlow()

    val subjects: List<String> = Subject.entries.map { it.label }

    fun onSubjectChange(value: String) { _subject.value = value }
    fun onFocusChange(value: String) { _focus.value = value }

    fun generatePlan() {
        viewModelScope.launch {
            _plan.value = LoadingState.Loading
            val subject = _subject.value
            val focusText = _focus.value.trim().takeIf { it.isNotEmpty() }
            val result = runCatching {
                val response = container.apiClient.api.plan(PlanRequest(subject = subject, focus = focusText))
                // 落缓存：序列化整条响应，便于离线回放。
                val json = ApiClient.json.encodeToString(PlanResponse.serializer(), response)
                container.dataRepository.savePlanCache(subject = subject, focus = focusText, planJson = json)
                _isOffline.value = false
                _showCachedBanner.value = false
                response
            }
            result.onSuccess { _plan.value = LoadingState.Loaded(it) }
                .onFailure { error ->
                    _isOffline.value = error is NetworkError.NetworkUnavailable
                    if (error is NetworkError.NetworkUnavailable) {
                        // 网络不可用 → 回退到 Room 缓存。
                        loadCachedPlan(subject, focusText)
                    } else {
                        _plan.value = LoadingState.Error(error)
                    }
                }
        }
    }

    private suspend fun loadCachedPlan(subject: String, focus: String?) {
        val cached = runCatching { container.dataRepository.fetchLatestPlan(subject) }.getOrNull()
        if (cached != null) {
            val response = runCatching {
                ApiClient.json.decodeFromString(PlanResponse.serializer(), cached.planJson)
            }.getOrNull()
            if (response != null) {
                _plan.value = LoadingState.Loaded(response)
                _showCachedBanner.value = true
                return
            }
        }
        _plan.value = LoadingState.Error(NetworkError.NetworkUnavailable)
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = PlanViewModel(container) as T
            }
    }
}
