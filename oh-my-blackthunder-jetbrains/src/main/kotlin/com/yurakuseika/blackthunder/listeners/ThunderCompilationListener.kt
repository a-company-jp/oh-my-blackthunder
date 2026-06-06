package com.yurakuseika.blackthunder.listeners

import com.intellij.openapi.compiler.CompilationStatusListener
import com.intellij.openapi.compiler.CompileContext
import com.intellij.openapi.project.Project
import com.yurakuseika.blackthunder.core.ThunderNotifier
import com.yurakuseika.blackthunder.core.ThunderStats

/**
 * ビルド完了を監視し、エラーなしで成功したらご褒美通知を出す。
 * plugin.xml の projectListeners 経由で登録される。
 */
class ThunderCompilationListener(private val project: Project) : CompilationStatusListener {

    override fun compilationFinished(
        aborted: Boolean,
        errors: Int,
        warnings: Int,
        compileContext: CompileContext,
    ) {
        if (aborted || errors > 0) return

        val stats = ThunderStats.getInstance()
        val barsBefore = stats.thunderBars
        stats.recordSuccessfulBuild()

        ThunderNotifier.reward(project)
        maybeCelebrateMilestone(barsBefore, stats)
    }

    private fun maybeCelebrateMilestone(barsBefore: Int, stats: ThunderStats) {
        val barsAfter = stats.thunderBars
        if (barsAfter > barsBefore) {
            ThunderNotifier.milestone(project, barsAfter)
        }
    }
}
