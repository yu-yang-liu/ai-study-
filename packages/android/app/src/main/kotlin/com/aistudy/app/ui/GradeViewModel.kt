package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.apicontracts.GradeMathResponse
import com.aistudy.apicontracts.GradeQuestionType
import com.aistudy.apicontracts.GradeRequest
import com.aistudy.apicontracts.GradeResult
import com.aistudy.apicontracts.Subject
import com.aistudy.corekit.net.NetworkError
import com.aistudy.corekit.ui.LoadingState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/** 作业批改 ViewModel（镜像 iOS `GradeViewModel`）。`grade` 返回 raw JSON，按 questionType 解码。 */
class GradeViewModel(private val container: AppContainer) : ViewModel() {

    private val _subject = MutableStateFlow("数学")
    val subject: StateFlow<String> = _subject.asStateFlow()

    private val _questionType = MutableStateFlow(GradeQuestionType.MATH)
    val questionType: StateFlow<GradeQuestionType> = _questionType.asStateFlow()

    private val _questionContent = MutableStateFlow("")
    val questionContent: StateFlow<String> = _questionContent.asStateFlow()

    private val _studentAnswer = MutableStateFlow("")
    val studentAnswer: StateFlow<String> = _studentAnswer.asStateFlow()

    private val _result = MutableStateFlow<LoadingState<GradeResult>>(LoadingState.Idle)
    val result: StateFlow<LoadingState<GradeResult>> = _result.asStateFlow()

    private val _isOffline = MutableStateFlow(false)
    val isOffline: StateFlow<Boolean> = _isOffline.asStateFlow()

    val subjects: List<String> = Subject.entries.map { it.label }

    fun onSubjectChange(value: String) { _subject.value = value }
    fun onQuestionTypeChange(value: GradeQuestionType) { _questionType.value = value }
    fun onQuestionContentChange(value: String) { _questionContent.value = value }
    fun onStudentAnswerChange(value: String) { _studentAnswer.value = value }

    fun submitForGrading() {
        val q = _questionContent.value.trim()
        val a = _studentAnswer.value.trim()
        if (q.length < 10) {
            _result.value = LoadingState.Error(IllegalArgumentException("请输入至少10字的题目内容"))
            return
        }
        if (a.isEmpty()) {
            _result.value = LoadingState.Error(IllegalArgumentException("请输入你的作答内容"))
            return
        }

        viewModelScope.launch {
            _result.value = LoadingState.Loading
            val type = _questionType.value
            val result = runCatching {
                val raw = container.apiClient.api.grade(
                    GradeRequest(
                        subject = _subject.value,
                        questionType = type,
                        questionContent = q,
                        studentAnswer = a,
                    ),
                )
                val rawText = raw.string()
                val gradeResult: GradeResult = when (type) {
                    GradeQuestionType.MATH -> GradeResult.Math(com.aistudy.corekit.net.ApiClient.json.decodeFromString(GradeMathResponse.serializer(), rawText))
                    GradeQuestionType.ESSAY -> GradeResult.Essay(com.aistudy.corekit.net.ApiClient.json.decodeFromString(com.aistudy.apicontracts.GradeEssayResponse.serializer(), rawText))
                }
                val (score, maxScore) = when (gradeResult) {
                    is GradeResult.Math -> gradeResult.data.score to gradeResult.data.maxScore
                    is GradeResult.Essay -> gradeResult.data.score to gradeResult.data.maxScore
                }
                container.dataRepository.saveGradeRecord(
                    subject = _subject.value,
                    questionType = type.value,
                    questionContent = q,
                    studentAnswer = a,
                    resultJson = rawText,
                    score = score,
                    maxScore = maxScore,
                )
                gradeResult
            }
            result.onSuccess { _result.value = LoadingState.Loaded(it); _isOffline.value = false }
                .onFailure { error ->
                    _result.value = LoadingState.Error(error)
                    _isOffline.value = error is NetworkError.NetworkUnavailable
                }
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = GradeViewModel(container) as T
            }
    }
}
