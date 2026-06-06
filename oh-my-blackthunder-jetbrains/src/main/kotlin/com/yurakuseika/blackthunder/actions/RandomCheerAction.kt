package com.yurakuseika.blackthunder.actions

import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAware
import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.yurakuseika.blackthunder.core.ThunderNotifier

/**
 * 手動でランダムな応援メッセージを出すアクション。
 * メニュー: Tools → ブラックサンダーの一言⚡
 */
class RandomCheerAction : AnAction(), DumbAware {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        ThunderNotifier.cheer(e.project)
    }
}
