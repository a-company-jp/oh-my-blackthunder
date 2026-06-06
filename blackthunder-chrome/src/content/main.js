/*
 * ThunderCaptcha — オーケストレーション（content script エントリ）
 *
 * 1) capture-phase の click listener で Merge 系ボタンを安定的に捕捉
 * 2) 認証済み(30秒以内) / bypass 対象ならそのまま通す（無限ループ回避）
 * 3) 未認証なら ThunderCaptcha モーダルを表示し、認証後に元クリックを再実行
 * 4) MutationObserver で Merge ボタンに「⚡ Thunder Protected」バッジを付与
 *
 * 依存（先に読み込まれた content script が self.BTCI に載せている）:
 *   getPrKeyFromPathname, findMergeElement, isMergeButtonText, getButtonText,
 *   isDisabled, CANDIDATE_SELECTOR, isVerified, markVerified,
 *   showThunderCaptcha, celebrate, notifyLauncher
 */
(function () {
  "use strict";

  var BTCI = self.BTCI || {};

  // 認証後に再実行するクリックを一時的に素通しさせる集合。
  var bypass = new WeakSet();

  function currentPrKey() {
    return BTCI.getPrKeyFromPathname(location.pathname);
  }

  /**
   * 認証通過後の共通処理: 記録 → 演出 → Launcher 通知 → 元クリック再実行。
   */
  function proceedMerge(targetEl) {
    var prKey = currentPrKey();
    if (prKey) BTCI.markVerified(prKey);

    // 演出（GitHub 側 Merge が権限/状態で失敗しても演出は出る）
    try {
      BTCI.celebrate();
    } catch (e) {
      console.warn("[ThunderCaptcha] celebrate failed:", e);
    }

    if (prKey) BTCI.notifyLauncher(prKey);

    // 元のボタンを bypass フラグ付きで再クリック → 無限ループしない
    bypass.add(targetEl);
    try {
      targetEl.click();
    } finally {
      // 同期 click 処理が終わった後に解除
      setTimeout(function () {
        bypass.delete(targetEl);
      }, 0);
    }
  }

  function onClickCapture(event) {
    var mergeEl = BTCI.findMergeElement(event.target);
    if (!mergeEl) return;

    // 認証後の再実行クリックは素通し
    if (bypass.has(mergeEl)) return;

    // 30 秒以内に認証済みの PR は素通し
    var prKey = currentPrKey();
    if (prKey && BTCI.isVerified(prKey)) return;

    // ここから ThunderCaptcha でゲートする
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    BTCI.showThunderCaptcha().then(function (ok) {
      if (ok) proceedMerge(mergeEl);
    });
  }

  document.addEventListener("click", onClickCapture, true);

  // ===== バッジ付与 =====

  function addBadge(el) {
    if (!el || el.getAttribute("data-bt-ci-badged") === "1") return;
    if (BTCI.isDisabled(el)) return;

    var text = BTCI.getButtonText(el);
    if (!BTCI.isMergeButtonText(text)) return;

    el.setAttribute("data-bt-ci-badged", "1");

    var badge = document.createElement("span");
    badge.className = "bt-ci-badge";
    badge.textContent = "⚡ Thunder Protected";

    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input") {
      // input には子要素を append できないので隣に挿入
      el.insertAdjacentElement("afterend", badge);
    } else {
      el.appendChild(badge);
    }
  }

  function scanForButtons(rootNode) {
    var scope = rootNode && rootNode.querySelectorAll ? rootNode : document;
    var nodes = scope.querySelectorAll(BTCI.CANDIDATE_SELECTOR);
    for (var i = 0; i < nodes.length; i++) {
      addBadge(nodes[i]);
    }
  }

  var rafPending = false;
  function scheduleScan() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      scanForButtons(document);
    });
  }

  var observer = new MutationObserver(function () {
    // 細かい変化のたびに走らせず、まとめて 1 回スキャン
    scheduleScan();
  });

  function start() {
    scanForButtons(document);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
