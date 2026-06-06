package com.yurakuseika.blackthunder.core

import com.intellij.openapi.application.ApplicationManager
import com.intellij.openapi.diagnostic.thisLogger
import java.io.BufferedInputStream
import java.util.concurrent.CountDownLatch
import java.util.concurrent.atomic.AtomicLong
import javax.sound.sampled.AudioSystem
import javax.sound.sampled.LineEvent

/**
 * 「ザクザク」音（[crunch.wav]）を鳴らす。
 *
 * - 外部プロセスに頼らず JVM の [javax.sound.sampled] で再生（ヘッドレス/全OS対応）。
 * - IntelliJ は一括保存で短時間に何度も保存イベントが走るため、スロットルで連打を抑える。
 * - 再生はプール上で行い、EDT をブロックしない。
 */
object ThunderSound {

    private const val RESOURCE = "/sounds/crunch.wav"
    private const val THROTTLE_MS = 400L

    private val lastPlayNanos = AtomicLong(Long.MIN_VALUE)

    /** スロットル付きで再生（保存イベントなど高頻度の呼び出し用）。 */
    fun playCrunchThrottled() {
        val now = System.nanoTime()
        val last = lastPlayNanos.get()
        if (last != Long.MIN_VALUE && now - last < THROTTLE_MS * 1_000_000L) return
        if (!lastPlayNanos.compareAndSet(last, now)) return
        play()
    }

    /** スロットル無しで即再生（手動アクション用）。 */
    fun play() {
        ApplicationManager.getApplication().executeOnPooledThread { playBlocking() }
    }

    private fun playBlocking() {
        try {
            val resource = ThunderSound::class.java.getResourceAsStream(RESOURCE) ?: run {
                thisLogger().warn("Black Thunder: sound resource not found: $RESOURCE")
                return
            }
            resource.use { raw ->
                AudioSystem.getAudioInputStream(BufferedInputStream(raw)).use { audio ->
                    val clip = AudioSystem.getClip()
                    val finished = CountDownLatch(1)
                    clip.addLineListener { event ->
                        if (event.type == LineEvent.Type.STOP) finished.countDown()
                    }
                    clip.open(audio)
                    clip.start()
                    finished.await()
                    clip.close()
                }
            }
        } catch (t: Throwable) {
            // 音が鳴らせない環境でも本体の動作は止めない。
            thisLogger().warn("Black Thunder: failed to play crunch sound", t)
        }
    }
}
