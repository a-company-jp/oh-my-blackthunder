/*
 * ThunderCaptcha — 物理 Launcher 連携（content 側）
 *
 * content script から直接 fetch せず、background(service worker) に投げる。
 * 失敗しても UI / Merge 演出は止めない（握りつぶして console.warn のみ）。
 *
 * self.BTCI に載せる。
 */
(function (root) {
  "use strict";

  /**
   * 拡張 context が生きているか。拡張をリロードすると、開きっぱなしの
   * タブに残った古い content script からは context が無効化され、
   * chrome.runtime.id が undefined になり sendMessage は
   * "Extension context invalidated" を投げる。先に弾いて黙って諦める。
   * @returns {boolean}
   */
  function isExtensionAlive() {
    try {
      return !!(chrome && chrome.runtime && chrome.runtime.id);
    } catch (e) {
      return false;
    }
  }

  /**
   * @param {string} prKey 例: "owner/repo#123"
   */
  function notifyLauncher(prKey) {
    // context 無効（拡張リロード後の古いタブ等）なら何もしない。
    // Merge 演出は止めない設計なので、ここは静かに諦めるのが正しい。
    if (!isExtensionAlive()) return;

    try {
      chrome.runtime.sendMessage(
        { type: "bt-ci:launcher", pr: prKey },
        function () {
          // sendMessage のコールバックで lastError を読んでおくと
          // "Unchecked runtime.lastError" の警告を抑止できる。
          var err = chrome.runtime && chrome.runtime.lastError;
          if (err) {
            console.warn("[ThunderCaptcha] launcher message failed:", err.message);
          }
        }
      );
    } catch (e) {
      // context invalidated 等。Merge 演出は止めないので握りつぶす。
      console.debug("[ThunderCaptcha] launcher message skipped:", e && e.message);
    }
  }

  root.BTCI = Object.assign(root.BTCI || {}, {
    notifyLauncher: notifyLauncher
  });
})(typeof self !== "undefined" ? self : this);
