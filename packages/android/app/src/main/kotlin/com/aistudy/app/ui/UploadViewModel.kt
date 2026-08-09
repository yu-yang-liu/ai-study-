package com.aistudy.app.ui

import android.content.Context
import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.AnalyzeRequest
import com.aistudy.apicontracts.AnalyzeResponse
import com.aistudy.apicontracts.Subject
import com.aistudy.apicontracts.UploadResponse
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * 拍照上传 ViewModel（镜像 iOS `UploadViewModel`）。
 * 选图 → MIME 嗅探 → presign → PUT S3 → analyze → 结果展示。
 */
class UploadViewModel(private val container: AppContainer) : ViewModel() {

    private val _selectedSubject = MutableStateFlow("数学")
    val selectedSubject: StateFlow<String> = _selectedSubject.asStateFlow()

    private val _imageUri = MutableStateFlow<Uri?>(null)
    val imageUri: StateFlow<Uri?> = _imageUri.asStateFlow()

    private val _imageUrl = MutableStateFlow<String?>(null)
    val imageUrl: StateFlow<String?> = _imageUrl.asStateFlow()

    private val _uploadState = MutableStateFlow<LoadingState<UploadResponse>>(LoadingState.Idle)
    val uploadState: StateFlow<LoadingState<UploadResponse>> = _uploadState.asStateFlow()

    private val _analyzeState = MutableStateFlow<LoadingState<AnalyzeResponse>>(LoadingState.Idle)
    val analyzeState: StateFlow<LoadingState<AnalyzeResponse>> = _analyzeState.asStateFlow()

    val subjects: List<String> = Subject.entries.map { it.label }

    fun onSubjectChange(value: String) { _selectedSubject.value = value }

    fun setImage(uri: Uri?) {
        _imageUri.value = uri
        _imageUrl.value = null
        _uploadState.value = LoadingState.Idle
        _analyzeState.value = LoadingState.Idle
    }

    fun reset() {
        _imageUri.value = null
        _imageUrl.value = null
        _uploadState.value = LoadingState.Idle
        _analyzeState.value = LoadingState.Idle
    }

    fun upload(context: Context) {
        val uri = _imageUri.value ?: return
        viewModelScope.launch {
            _uploadState.value = LoadingState.Loading
            val result = runCatching {
                val bytes = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?: error("无法读取图片")
                }
                val mime = mimeType(bytes)
                container.apiClient.uploadImage(bytes, mime)
            }
            result.onSuccess {
                _imageUrl.value = it.url
                _uploadState.value = LoadingState.Loaded(it)
            }.onFailure { _uploadState.value = LoadingState.Error(it) }
        }
    }

    fun analyze() {
        val url = _imageUrl.value ?: return
        viewModelScope.launch {
            _analyzeState.value = LoadingState.Loading
            val result = runCatching {
                container.apiClient.api.analyze(AnalyzeRequest(imageUrl = url, subject = _selectedSubject.value))
            }
            result.onSuccess { _analyzeState.value = LoadingState.Loaded(it) }
                .onFailure { _analyzeState.value = LoadingState.Error(it) }
        }
    }

    /** 魔数嗅探 MIME（对齐 iOS mimeType(for:)）。 */
    private fun mimeType(bytes: ByteArray): String = when {
        bytes.size >= 3 && bytes[0] == 0xFF.toByte() && bytes[1] == 0xD8.toByte() && bytes[2] == 0xFF.toByte() -> "image/jpeg"
        bytes.size >= 4 && bytes[0] == 0x89.toByte() && bytes[1] == 0x50.toByte() && bytes[2] == 0x4E.toByte() && bytes[3] == 0x47.toByte() -> "image/png"
        bytes.size >= 3 && bytes[0] == 0x47.toByte() && bytes[1] == 0x49.toByte() && bytes[2] == 0x46.toByte() -> "image/gif"
        else -> "image/jpeg"
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = UploadViewModel(container) as T
            }
    }
}
