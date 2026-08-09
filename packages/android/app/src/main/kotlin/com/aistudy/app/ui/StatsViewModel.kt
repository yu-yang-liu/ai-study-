package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.StatsResponse
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 学习统计 ViewModel（镜像 iOS `StatsViewModel`）：GET /api/stats → 只读仪表盘。 */
class StatsViewModel(private val container: AppContainer) : ViewModel() {

    private val _stats = MutableStateFlow<LoadingState<StatsResponse>>(LoadingState.Idle)
    val stats: StateFlow<LoadingState<StatsResponse>> = _stats.asStateFlow()

    fun load() {
        viewModelScope.launch {
            _stats.value = LoadingState.Loading
            val result = runCatching { container.apiClient.api.stats() }
            result.onSuccess { _stats.value = LoadingState.Loaded(it) }
                .onFailure { _stats.value = LoadingState.Error(it) }
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = StatsViewModel(container) as T
            }
    }
}
