package com.aistudy.corekit.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// MARK: - 品牌色（镜像 iOS Color+Brand.swift）
// brandPrimary #0f172a / brandAccent #64748b

val brandPrimary = Color(0xFF0F172A)
val brandAccent = Color(0xFF64748B)
val brandPrimaryContainer = Color(0xFF1E293B)
val brandAccentContainer = Color(0xFF94A3B8)
val brandSurface = Color(0xFFF8FAFC)
val brandSurfaceDark = Color(0xFF0B1120)
val brandBackground = Color(0xFFFFFFFF)
val brandBackgroundDark = Color(0xFF0F172A)

private val LightColors = lightColorScheme(
    primary = brandPrimary,
    onPrimary = Color.White,
    primaryContainer = brandPrimaryContainer,
    onPrimaryContainer = Color.White,
    secondary = brandAccent,
    onSecondary = Color.White,
    secondaryContainer = brandAccentContainer,
    onSecondaryContainer = brandPrimary,
    background = brandBackground,
    surface = brandSurface,
)

private val DarkColors = darkColorScheme(
    primary = brandAccentContainer,
    onPrimary = brandPrimary,
    primaryContainer = brandPrimaryContainer,
    onPrimaryContainer = Color.White,
    secondary = brandAccent,
    onSecondary = Color.White,
    secondaryContainer = brandPrimaryContainer,
    onSecondaryContainer = Color.White,
    background = brandBackgroundDark,
    surface = brandSurfaceDark,
)

/**
 * 应用主题（镜像 iOS 基于 brandPrimary/brandAccent 的配色）。
 * 默认跟随系统深色模式。
 */
@Composable
fun BrandTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit,
) {
    MaterialTheme(
        colorScheme = if (darkTheme) DarkColors else LightColors,
        content = content,
    )
}
