package com.yurakuseika.blackthunder.core

import com.intellij.notification.NotificationGroupManager
import com.intellij.notification.NotificationType
import com.intellij.openapi.project.Project

/**
 * ブラックサンダー風の通知を出すためのヘルパー。
 * 通知グループ "BlackThunder" は plugin.xml で登録する。
 */
object ThunderNotifier {

    private const val GROUP_ID = "BlackThunder"
    private const val TITLE = "ブラックサンダー⚡"

    private fun notify(project: Project?, content: String, type: NotificationType) {
        NotificationGroupManager.getInstance()
            .getNotificationGroup(GROUP_ID)
            .createNotification(TITLE, content, type)
            .notify(project)
    }

    /** 起動時などの応援メッセージ。 */
    fun cheer(project: Project?, message: String = ThunderQuotes.randomCheer()) {
        notify(project, message, NotificationType.INFORMATION)
    }

    /** ビルド成功・テスト成功などのご褒美。 */
    fun reward(project: Project?, message: String = ThunderQuotes.randomReward()) {
        notify(project, message, NotificationType.INFORMATION)
    }

    /** マイルストーン（ブラックサンダー○個分達成など）。 */
    fun milestone(project: Project?, bars: Int) {
        notify(
            project,
            "通算ブラックサンダー $bars 個分のがんばり達成🍫⚡ おつかれさま！",
            NotificationType.INFORMATION,
        )
    }
}
