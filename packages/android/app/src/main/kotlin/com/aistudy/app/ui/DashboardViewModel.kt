package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 仪表盘 ViewModel（镜像 iOS `DashboardView` 的倒计时 + 题库数）。
 * 倒计时从 Room UserSettings 读 `daysRemaining`；题库数走无鉴权的 `/api/bank/count`。
 */
class DashboardViewModel(private val container: AppContainer) : ViewModel() {

    private val _daysRemaining = MutableStateFlow(0)
    val daysRemaining: StateFlow<Int> = _daysRemaining.asStateFlow()

    private val _bankCount = MutableStateFlow<Int?>(null)
    val bankCount: StateFlow<Int?> = _bankCount.asStateFlow()

    init {
        loadCountdown()
        loadBankCount()
    }

    private fun loadCountdown() {
        viewModelScope.launch {
            val settings = container.dataRepository.fetchOrCreateSettings()
            _daysRemaining.value = settings.daysRemaining
        }
    }

    private fun loadBankCount() {
        viewModelScope.launch {
            _bankCount.value = runCatching {
                container.apiClient.api.bankCount().count
            }.getOrNull()
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    DashboardViewModel(container) as T
            }
    }
}
