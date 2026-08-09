package com.aistudy.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MenuBook
import androidx.compose.material3.Card
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.aistudy.app.AppContainer
import com.aistudy.corekit.config.FeatureFlags
import com.aistudy.corekit.ui.brandAccent
import com.aistudy.corekit.ui.brandPrimary

/**
 * 真题演练占位屏（镜像 iOS `RealExamPlaceholderView`）。
 * 真题功能本期不实现，仅占位并展示题库数。
 */
@Composable
fun RealExamPlaceholder(
    container: AppContainer,
    viewModel: DashboardViewModel = viewModel(factory = DashboardViewModel.factory(container)),
) {
    val bankCount by viewModel.bankCount.collectAsState()

    Box(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        contentAlignment = Alignment.Center,
    ) {
        Card(
            shape = RoundedCornerShape(24.dp),
            modifier = Modifier.fillMaxWidth(),
        ) {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(64.dp),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(Icons.Filled.MenuBook, contentDescription = null, tint = brandAccent, modifier = Modifier.size(48.dp))
                }
                Text("真题演练", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
                Text(
                    if (FeatureFlags.isRealExamEnabled) "即将上线" else "功能开发中，敬请期待",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    "题库现有 ${bankCount ?: "—"} 道题目",
                    style = MaterialTheme.typography.bodySmall,
                    color = brandPrimary,
                )
            }
        }
    }
}
