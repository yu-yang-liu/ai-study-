package com.aistudy.corekit.auth

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import com.aistudy.corekit.config.AppEnvironment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.security.GeneralSecurityException
import java.io.IOException

/**
 * 安全 Token 存储（镜像 iOS `actor TokenStorage` / Keychain）。
 *
 * 基于 [EncryptedSharedPreferences]（MasterKey AES256_GCM）。
 * backup/restore 后可能抛 [GeneralSecurityException]：构造时 try/catch → 清空并重建，
 * 对齐 iOS 的优雅降级（宁可丢 token 重新登录，也不崩溃）。
 */
class TokenStorage(private val context: Context) {

    private val prefs: SharedPreferences = openOrReset()

    private fun openOrReset(): SharedPreferences {
        return try {
            createPrefs()
        } catch (e: GeneralSecurityException) {
            // 加密状态损坏（常见于 backup/restore 后）→ 清空重建，降级为未登录。
            try {
                context.deleteSharedPreferences(AppEnvironment.tokenStoreFileName)
            } catch (_: Exception) {
                // 忽略删除失败
            }
            try {
                createPrefs()
            } catch (e2: GeneralSecurityException) {
                // 仍失败：退回不加密的 prefs，至少不崩溃（调用方会读到空 token → 未登录）。
                context.getSharedPreferences("${AppEnvironment.tokenStoreFileName}.fallback", Context.MODE_PRIVATE)
            }
        } catch (e: IOException) {
            context.getSharedPreferences("${AppEnvironment.tokenStoreFileName}.fallback", Context.MODE_PRIVATE)
        }
    }

    private fun createPrefs(): SharedPreferences {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        return EncryptedSharedPreferences.create(
            context,
            AppEnvironment.tokenStoreFileName,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    suspend fun saveSession(
        accessToken: String,
        refreshToken: String?,
        expiresAt: Int,
        userId: String?,
        userEmail: String?,
    ) = withContext(Dispatchers.IO) {
        prefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .putInt(KEY_EXPIRES_AT, expiresAt)
            .putString(KEY_USER_ID, userId)
            .putString(KEY_USER_EMAIL, userEmail)
            .apply()
    }

    suspend fun accessToken(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_ACCESS_TOKEN, null)
    }

    suspend fun refreshToken(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_REFRESH_TOKEN, null)
    }

    suspend fun expiresAt(): Int = withContext(Dispatchers.IO) {
        prefs.getInt(KEY_EXPIRES_AT, 0)
    }

    suspend fun userId(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_USER_ID, null)
    }

    suspend fun userEmail(): String? = withContext(Dispatchers.IO) {
        prefs.getString(KEY_USER_EMAIL, null)
    }

    suspend fun clear() = withContext(Dispatchers.IO) {
        prefs.edit().clear().apply()
    }

    companion object {
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
        private const val KEY_EXPIRES_AT = "expires_at"
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_EMAIL = "user_email"
    }
}
