package com.aistudy.app.ui

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.aistudy.app.AppContainer
import com.aistudy.corekit.auth.AuthManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 登录页 ViewModel（镜像 iOS `LoginView` 的 performLogin/performRegister）。
 * 持有 email/password/isLoading/errorMessage，调用 [AuthManager]。
 */
class LoginViewModel(private val authManager: AuthManager) : ViewModel() {

    private val _email = MutableStateFlow("")
    val email: StateFlow<String> = _email.asStateFlow()

    private val _password = MutableStateFlow("")
    val password: StateFlow<String> = _password.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    private val _errorMessage = MutableStateFlow<String?>(null)
    val errorMessage: StateFlow<String?> = _errorMessage.asStateFlow()

    private val _registerSuccess = MutableStateFlow(false)
    val registerSuccess: StateFlow<Boolean> = _registerSuccess.asStateFlow()

    fun onEmailChange(value: String) { _email.value = value }
    fun onPasswordChange(value: String) { _password.value = value }

    val canLogin: Boolean
        get() = !_isLoading.value && _email.value.isNotBlank() && _password.value.isNotBlank()

    val canRegister: Boolean
        get() = !_isLoading.value && _email.value.isNotBlank() && _password.value.length >= 8

    fun login() {
        if (!canLogin) return
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = authManager.login(_email.value, _password.value)
            _isLoading.value = false
            result.onFailure { _errorMessage.value = it.message ?: "登录失败" }
        }
    }

    fun register() {
        if (!canRegister) return
        viewModelScope.launch {
            _isLoading.value = true
            _errorMessage.value = null
            val result = authManager.register(_email.value, _password.value)
            _isLoading.value = false
            result.onSuccess {
                _registerSuccess.value = true
                _password.value = ""
            }.onFailure { _errorMessage.value = it.message ?: "注册失败" }
        }
    }

    fun consumeRegisterSuccess() { _registerSuccess.value = false }

    companion object {
        fun factory(container: AppContainer): ViewModelProvider.Factory =
            object : ViewModelProvider.Factory {
                @Suppress("UNCHECKED_CAST")
                override fun <T : ViewModel> create(modelClass: Class<T>): T =
                    LoginViewModel(container.authManager) as T
            }
    }
}
