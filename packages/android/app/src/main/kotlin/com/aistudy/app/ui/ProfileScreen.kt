package com.aistudy.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountCircle
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.DarkMode
import androidx.compose.material.icons.filled.LightMode
import androidx.compose.material.icons.filled.Smartphone
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aistudy.app.AppContainer
import com.aistudy.corekit.ui.brandAccent
import com.aistudy.corekit.ui.brandPrimary
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId

/**
 * 用户设置 / 「我的」屏（镜像 iOS `ProfileView`）。
 *
 * 以表单分段呈现：个人信息 / 考试信息 / 学习目标 / 学习偏好 / 通知 / 主题 / 账户信息 / 退出登录。
 * 由 [MainScaffold] 的 AppBar 以 ModalBottomSheet 打开。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProfileScreen(
    container: AppContainer,
    viewModel: ProfileViewModel = viewModel(factory = ProfileViewModel.factory(container)),
) {
    LaunchedEffect(Unit) { viewModel.loadSettings() }

    val nickname by viewModel.nickname.collectAsState()
    val examDateEpochDay by viewModel.examDate.collectAsState()
    val targetScore by viewModel.targetScore.collectAsState()
    val notificationsEnabled by viewModel.notificationsEnabled.collectAsState()
    val gradeLevel by viewModel.gradeLevel.collectAsState()
    val track by viewModel.track.collectAsState()
    val themeMode by viewModel.themeMode.collectAsState()
    val isLoading by viewModel.isLoading.collectAsState()
    val saveSuccess by viewModel.saveSuccess.collectAsState()
    val errorMessage by viewModel.errorMessage.collectAsState()

    var showDatePicker by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        // 保存成功横幅
        if (saveSuccess) {
            SaveSuccessBanner()
        }

        // MARK: - 个人信息
        Section(title = "个人信息") {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                Avatar(nickname)
                Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    OutlinedTextField(
                        value = nickname,
                        onValueChange = viewModel::onNicknameChange,
                        label = { Text("昵称") },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth(),
                    )
                    Text(viewModel.userEmail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                }
            }
        }

        // MARK: - 考试信息
        Section(title = "考试信息", footer = "若考试年份已过，系统会在启动时提醒您更新") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column {
                    Text("考试日期", style = MaterialTheme.typography.bodyLarge)
                    Text(
                        LocalDate.ofEpochDay(examDateEpochDay).toString(),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                TextButton(onClick = { showDatePicker = true }) { Text("修改日期") }
            }
            HorizontalDivider()
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
            ) {
                Text("倒计时", style = MaterialTheme.typography.bodyLarge)
                Text("${viewModel.daysRemaining} 天", style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Bold, color = brandAccent)
            }
        }

        // MARK: - 学习目标
        Section(title = "学习目标") {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("目标分数", style = MaterialTheme.typography.bodyLarge)
                OutlinedTextField(
                    value = targetScore,
                    onValueChange = viewModel::onTargetScoreChange,
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                    textStyle = MaterialTheme.typography.bodyLarge.copy(textAlign = TextAlign.End),
                )
                Text("分", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }

        // MARK: - 学习偏好
        Section(title = "学习偏好") {
            Text("当前年级", style = MaterialTheme.typography.bodyLarge)
            ChipRow(options = viewModel.gradeLevelOptions, selected = gradeLevel, onSelect = viewModel::onGradeLevelChange)
            Spacer(Modifier.height(4.dp))
            Text("文理分科", style = MaterialTheme.typography.bodyLarge)
            ChipRow(options = viewModel.trackOptions, selected = track, onSelect = viewModel::onTrackChange)
        }

        // MARK: - 通知
        Section(title = "通知设置", footer = "开启后每天 19:00 提醒您完成学习任务（通知调度后续接入）") {
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text("每日学习提醒", style = MaterialTheme.typography.bodyLarge)
                Switch(checked = notificationsEnabled, onCheckedChange = viewModel::onNotificationsChange)
            }
        }

        // MARK: - 主题
        Section(title = "界面主题") {
            val themeIcon = when (themeMode) {
                "light" -> Icons.Filled.LightMode
                "dark" -> Icons.Filled.DarkMode
                else -> Icons.Filled.Smartphone
            }
            ChipRow(
                options = viewModel.themeOptions.map { it.second },
                selected = viewModel.themeOptions.first { it.first == themeMode }.second,
                onSelect = { label ->
                    viewModel.onThemeModeChange(viewModel.themeOptions.first { it.second == label }.first)
                },
                leadingIcon = { themeIcon },
            )
        }

        // MARK: - 学习画像（FeatureFlag 控制）
        Section(
            title = "学习画像",
            footer = if (viewModel.isLearnerProfileEnabled) "基于你的练习、错题与计划生成的学情快照" else "该功能正在开发中，敬请期待",
        ) {
            Text(
                "学习画像（敬请期待）",
                style = MaterialTheme.typography.bodyLarge,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }

        // MARK: - 账户信息
        Section(title = "账户信息") {
            AccountRow(label = "用户 ID", value = viewModel.userId)
            AccountRow(label = "绑定邮箱", value = viewModel.userEmail.ifEmpty { "未登录" })
        }

        errorMessage?.let {
            Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }

        // 保存 + 退出
        Button(
            onClick = viewModel::saveSettings,
            enabled = !isLoading,
            modifier = Modifier.fillMaxWidth(),
        ) { Text(if (isLoading) "保存中…" else "保存设置") }

        OutlinedButton(
            onClick = viewModel::logout,
            colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            modifier = Modifier.fillMaxWidth(),
        ) { Text("退出登录") }

        Spacer(Modifier.height(8.dp))
    }

    if (showDatePicker) {
        val initialMillis = remember(examDateEpochDay) {
            LocalDate.ofEpochDay(examDateEpochDay)
                .atStartOfDay(ZoneId.systemDefault())
                .toInstant()
                .toEpochMilli()
        }
        val state = rememberDatePickerState(initialSelectedDateMillis = initialMillis)
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = {
                    viewModel.onExamDateMillisChange(state.selectedDateMillis)
                    showDatePicker = false
                }) { Text("确定") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("取消") }
            },
        ) { DatePicker(state = state) }
    }
}

@Composable
private fun Section(
    title: String,
    footer: String? = null,
    content: @Composable () -> Unit,
) {
    Surface(
        color = MaterialTheme.colorScheme.surfaceVariant,
        shape = RoundedCornerShape(16.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold, color = brandPrimary)
            content()
            footer?.let {
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}

@Composable
private fun Avatar(nickname: String) {
    val initial = nickname.firstOrNull()?.toString() ?: "同"
    Surface(color = brandPrimary, shape = CircleShape, modifier = Modifier.size(56.dp)) {
        Box(contentAlignment = Alignment.Center) {
            Text(initial, color = Color.White, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChipRow(
    options: List<String>,
    selected: String,
    onSelect: (String) -> Unit,
    leadingIcon: @Composable (() -> Unit)? = null,
) {
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
        options.forEach { option ->
            FilterChip(
                selected = option == selected,
                onClick = { onSelect(option) },
                label = { Text(option) },
                leadingIcon = leadingIcon,
            )
        }
    }
}

@Composable
private fun AccountRow(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        Text(label, style = MaterialTheme.typography.bodyLarge)
        Text(value, style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
    }
}

@Composable
private fun SaveSuccessBanner() {
    Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = RoundedCornerShape(24.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Icon(Icons.Filled.Check, contentDescription = null, tint = brandAccent)
            Text("设置已保存", style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.Medium)
        }
    }
}
