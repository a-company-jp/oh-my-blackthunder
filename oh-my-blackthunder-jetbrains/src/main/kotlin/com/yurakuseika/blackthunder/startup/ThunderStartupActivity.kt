package com.yurakuseika.blackthunder.startup

import com.intellij.openapi.project.Project
import com.intellij.openapi.startup.ProjectActivity
import com.yurakuseika.blackthunder.core.ThunderNotifier

/**
 * プロジェクトを開いたときに、ランダムな応援メッセージで出迎える。
 */
class ThunderStartupActivity : ProjectActivity {
    override suspend fun execute(project: Project) {
        ThunderNotifier.cheer(project)
    }
}
