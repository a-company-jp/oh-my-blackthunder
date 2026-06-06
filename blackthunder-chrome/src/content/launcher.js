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
   * @param {string} prKey 例: "owner/repo#123"
   */
  function notifyLauncher(prKey) {
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
      console.warn("[ThunderCaptcha] launcher message threw:", e);
    }
  }

  root.BTCI = Object.assign(root.BTCI || {}, {
    notifyLauncher: notifyLauncher
  });
})(typeof self !== "undefined" ? self : this);
