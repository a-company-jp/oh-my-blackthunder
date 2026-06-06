package com.yurakuseika.blackthunder.actions

import com.intellij.openapi.actionSystem.ActionUpdateThread
import com.intellij.openapi.actionSystem.AnAction
import com.intellij.openapi.actionSystem.AnActionEvent
import com.intellij.openapi.project.DumbAware
import com.yurakuseika.blackthunder.core.ThunderSound

/**
 * その場で「ザクザク」音を鳴らすアクション（VSCode 版の「ザクッと味見」相当）。
 * メニュー: Tools → ザクッと味見⚡
 */
class CrunchAction : AnAction(), DumbAware {

    override fun getActionUpdateThread(): ActionUpdateThread = ActionUpdateThread.BGT

    override fun actionPerformed(e: AnActionEvent) {
        ThunderSound.play()
    }
}
