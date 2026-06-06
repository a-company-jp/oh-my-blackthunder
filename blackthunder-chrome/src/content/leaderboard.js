/*
 * ThunderCaptcha — リーダーボード連携（content 側の薄いブリッジ）
 *
 * 認証成功時に background(service worker) へ "bt-ci:eat" を投げ、
 * ブラックサンダーカウントへ eat イベントを 1 件記録させる。
 * 実際のトークン取得 / fetch は background 側（leaderboard.js）で行う。
 *
 * 設計方針:
 *   - eat 記録は best-effort。失敗しても ThunderCaptcha / Merge 演出は止めない。
 *   - 成功 / 失敗は小さなトースト + console に出すだけ。
 *
 * self.BTCI に notifyEat を載せる。
 */
(function (root) {
  "use strict";

  /**
   * 拡張 context が生きているか（launcher.js と同じガード）。
   * 拡張リロード後の古いタブからは context が無効化されている。
   * @returns {boolean}
   */
  function isExtensionAlive() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  /** ごく小さなトースト（既存 effects のトーストとは別系統の軽量版）。 */
  function showLbToast(text, kind) {
    try {
      if (!document.body) return;
      var toast = document.createElement("div");
      toast.className = "bt-ci-lb-toast";
      if (kind === "error") toast.classList.add("bt-ci-lb-toast-error");
      toast.textContent = text;
      document.body.appendChild(toast);
      requestAnimationFrame(function () {
        toast.classList.add("bt-ci-lb-toast-in");
      });
      setTimeout(function () {
        toast.classList.remove("bt-ci-lb-toast-in");
        setTimeout(function () {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 350);
      }, 2600);
    } catch (e) {
      /* トースト失敗は無視 */
    }
  }

  /**
   * 認証成功を background に通知し、eat を 1 件記録させる。
   * 例外は握りつぶす。返り値なし（fire-and-forget）。
   */
  function notifyEat() {
    if (!isExtensionAlive()) return;

    try {
      chrome.runtime.sendMessage({ type: "bt-ci:eat" }, function (res) {
        var err = chrome.runtime && chrome.runtime.lastError;
        if (err) {
          // sender が閉じている等。Merge 演出には影響させない。
          console.debug(
            "[ThunderCaptcha] eat message failed:",
            err.message
          );
          return;
        }
        if (res && res.ok) {
          console.info("[ThunderCaptcha] eat recorded to leaderboard");
          showLbToast("🍫 ブラックサンダーカウント +1", "ok");
        } else {
          var reason = (res && res.reason) || "unknown";
          console.warn("[ThunderCaptcha] eat not recorded:", reason);
          if (reason === "not_connected") {
            showLbToast("リーダーボード未接続（拡張のポップアップから接続できます）", "error");
          } else if (reason === "unauthorized") {
            showLbToast("リーダーボード再接続が必要です", "error");
          }
          // それ以外（http エラー / fetch 失敗）はトーストを出さず黙って諦める。
        }
      });
    } catch (e) {
      // context invalidated 等。Merge 演出は止めないので握りつぶす。
      console.debug("[ThunderCaptcha] eat message skipped:", e && e.message);
    }
  }

  root.BTCI = Object.assign(root.BTCI || {}, {
    notifyEat: notifyEat
  });
})(typeof self !== "undefined" ? self : this);
