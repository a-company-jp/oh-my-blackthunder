package com.yurakuseika.blackthunder.listeners

import com.intellij.execution.testframework.sm.runner.SMTRunnerEventsAdapter
import com.intellij.execution.testframework.sm.runner.SMTestProxy
import com.intellij.openapi.project.Project
import com.yurakuseika.blackthunder.core.ThunderNotifier
import com.yurakuseika.blackthunder.core.ThunderStats

/**
 * テスト実行の完了を監視し、全部グリーンならご褒美通知を出す。
 * plugin.xml の projectListeners 経由で登録される。
 */
class ThunderTestListener(private val project: Project) : SMTRunnerEventsAdapter() {

    override fun onTestingFinished(testsRoot: SMTestProxy.SMRootTestProxy) {
        // 1件もテストが無い、または失敗があるときは何もしない。
        if (testsRoot.children.isEmpty()) return
        if (!testsRoot.isPassed) return

        val stats = ThunderStats.getInstance()
        val barsBefore = stats.thunderBars
        stats.recordTestsPassed()

        ThunderNotifier.reward(project, "全テストグリーン✅ ご褒美にブラックサンダーをどうぞ🍫⚡")

        val barsAfter = stats.thunderBars
        if (barsAfter > barsBefore) {
            ThunderNotifier.milestone(project, barsAfter)
        }
    }
}
