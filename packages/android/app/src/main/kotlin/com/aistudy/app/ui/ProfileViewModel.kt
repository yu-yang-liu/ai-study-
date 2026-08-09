package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.app.data.UserSettingsEntity
import com.aistudy.corekit.config.FeatureFlags
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * 用户设置 ViewModel（镜像 iOS `UserSettingsViewModel`）。
 *
 * - `loadSettings()` 从 Room 读单例回填表单。
 * - `saveSettings()` 构造 [UserSettingsEntity] 调 [com.aistudy.app.data.DataRepository.updateSettings]，
 *   据 examDate 重算倒计时（通知调度本期不做，仅存开关，对齐「通知本期排除」）。
 */
class ProfileViewModel(private val container: AppContainer) : ViewModel() {

    private val _nickname = MutableStateFlow("同学")
    val nickname: StateFlow<String> = _nickname.asStateFlow()

    private val _examDate = MutableStateFlow(UserSettingsEntity.defaultExamDateEpochDay())
    val examDate: StateFlow<Long> = _examDate.asStateFlow()

    private val _targetScore = MutableStateFlow("0")
    val targetScore: StateFlow<String> = _targetScore.asStateFlow()

    private val _notificationsEnabled = MutableStateFlow(true)
    val notificationsEnabled: StateFlow<Boolean> = _notificationsEnabled.asStateFlow()

    private val _gradeLevel = MutableStateFlow("高三")
    val gradeLevel: StateFlow<String> = _gradeLevel.asStateFlow()

    private val _track = MutableStateFlow("未分科")
    val track: StateFlow<String> = _track.asStateFlow()

    private val _themeMode = MutableStateFlow("system")
    val themeMode: StateFlow<String> = _themeMode.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _saveSuccess = MutableStateFlow(false)
    val saveSuccess: StateFlow<Boolean> = _saveSuccess.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    /** 当前登录用户邮箱（来自 AuthManager）。 */
    val userEmail: String
        get() = container.authManager.currentUser?.email ?: ""

    /** 当前登录用户 ID（来自 AuthManager）。 */
    val userId: String
        get() = container.authManager.currentUser?.id ?: "未登录"

    /** 展示名：昵称非默认用昵称，否则取邮箱 @ 前缀。 */
    val displayName: String
        get() = if (_nickname.value != "同学") {
            _nickname.value
        } else {
            userEmail.substringBefore("@").ifEmpty { "同学" }
        }

    /** 距考试日的剩余天数（据 [examDate] 实时算，UI 显示用）。 */
    val daysRemaining: Int
        get() = UserSettingsEntity.daysRemainingFrom(_examDate.value)

    /** 年级选项（高考阶段）。 */
    val gradeLevelOptions: List<String> = listOf("高一", "高二", "高三")

    /** 文理分科选项（镜像 iOS）。 */
    val trackOptions: List<String> = listOf("未分科", "文科", "理科")

    /** 主题选项：value → 展示标签。 */
    val themeOptions: List<Pair<String, String>> = listOf(
        "system" to "跟随系统",
        "light" to "浅色模式",
        "dark" to "深色模式",
    )

    fun onNicknameChange(value: String) { _nickname.value = value }
    fun onTargetScoreChange(value: String) { _targetScore.value = value.filter { it.isDigit() || it == '.' } }
    fun onNotificationsChange(value: Boolean) { _notificationsEnabled.value = value }
    fun onGradeLevelChange(value: String) { _gradeLevel.value = value }
    fun onTrackChange(value: String) { _track.value = value }
    fun onThemeModeChange(value: String) { _themeMode.value = value }

    /** DatePicker 以 UTC 毫秒返回选中日期，转 epoch day 后回填。 */
    fun onExamDateMillisChange(millis: Long?) {
        if (millis == null) return
        val localDate = Instant.ofEpochMilli(millis)
            .atZone(ZoneId.systemDefault())
            .toLocalDate()
        _examDate.value = localDate.toEpochDay()
    }

    fun loadSettings() {
        viewModelScope.launch {
            _isLoading.value = true
            val settings = container.dataRepository.fetchOrCreateSettings()
            _nickname.value = settings.nickname
            _examDate.value = settings.examDateEpochDay
            _targetScore.value = settings.targetScore.toString()
            _notificationsEnabled.value = settings.notificationsEnabled
            _gradeLevel.value = settings.gradeLevel
            _track.value = settings.track
            _themeMode.value = settings.themeMode
            _isLoading.value = false
        }
    }

    fun saveSettings() {
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val target = _targetScore.value.toDoubleOrNull() ?: 0.0
            val entity = UserSettingsEntity(
                id = UserSettingsEntity.singletonId,
                nickname = _nickname.value.trim().ifEmpty { "同学" },
                daysRemaining = daysRemaining, // updateSettings 内会据今日重算
                targetScore = target,
                notificationsEnabled = _notificationsEnabled.value,
                gradeLevel = _gradeLevel.value,
                track = _track.value,
                themeMode = _themeMode.value,
                examDateEpochDay = _examDate.value,
                updatedAt = System.currentTimeMillis(),
            )
            runCatching { container.dataRepository.updateSettings(entity) }
                .onSuccess {
                    _saveSuccess.value = true
                    delay(2000)
                    _saveSuccess.value = false
                }
                .onFailure { _errorMessage.value = "保存失败：${it.message}" }
            _isLoading.value = false
        }
    }

    /** 学习画像是否启用（受 FeatureFlags 控制，对齐 iOS 占位语义）。 */
    val isLearnerProfileEnabled: Boolean
        get() = FeatureFlags.isLearnerProfileEnabled

    fun logout() {
        viewModelScope.launch {
            container.authManager.logout()
        }
    }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T = ProfileViewModel(container) as T
            }
    }
}
