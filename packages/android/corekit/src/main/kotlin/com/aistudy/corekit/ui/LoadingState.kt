package com.aistudy.corekit.ui

/**
 * 通用加载状态（镜像 iOS `LoadingState` enum）。
 * 供 ViewModel 暴露 `StateFlow<LoadingState<T>>`，UI 按分支渲染。
 */
sealed interface LoadingState<out T> {
    data object Idle : LoadingState<Nothing>
    data object Loading : LoadingState<Nothing>
    data class Loaded<T>(val value: T) : LoadingState<T>
    data object Empty : LoadingState<Nothing>
    data class Error(val error: Throwable) : LoadingState<Nothing>
}
