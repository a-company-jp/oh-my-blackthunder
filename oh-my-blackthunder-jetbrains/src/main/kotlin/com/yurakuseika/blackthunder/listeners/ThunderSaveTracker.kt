package com.yurakuseika.blackthunder.listeners

import com.intellij.openapi.editor.Document
import com.intellij.openapi.fileEditor.FileDocumentManagerListener
import com.yurakuseika.blackthunder.core.ThunderNotifier
import com.yurakuseika.blackthunder.core.ThunderSettings
import com.yurakuseika.blackthunder.core.ThunderSound
import com.yurakuseika.blackthunder.core.ThunderStats

/**
 * ファイル保存を数えてがんばりカウンターに反映する。
 * 保存時に「ザクザク」音を鳴らし、ブラックサンダー1個分が貯まるたびに
 * マイルストーン通知を出す。plugin.xml の applicationListeners 経由で登録される。
 */
class ThunderSaveTracker : FileDocumentManagerListener {

    override fun beforeDocumentSaving(document: Document) {
        val stats = ThunderStats.getInstance()
        val barsBefore = stats.thunderBars
        stats.recordSave()

        // 保存時のザクザク音（設定で OFF 可・連打はスロットルで抑制）
        if (ThunderSettings.getInstance().soundOnSave) {
            ThunderSound.playCrunchThrottled()
        }

        val barsAfter = stats.thunderBars
        if (barsAfter > barsBefore) {
            // アプリレベルのリスナーなので特定プロジェクトには紐付けない。
            ThunderNotifier.milestone(null, barsAfter)
        }
    }
}
