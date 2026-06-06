/*
 * ThunderCaptcha — オーケストレーション（content script エントリ）
 *
 * 1) capture-phase の click listener + event.composedPath() で Merge 系ボタンを
 *    安定的に捕捉（GitHub は Merge ボタンを Shadow DOM 内に置くため、
 *    document.closest だけでは掴めない。composedPath は shadow 境界を越える）
 * 2) 認証済み(30秒以内) / bypass 対象ならそのまま通す（無限ループ回避）
 * 3) 未認証なら ThunderCaptcha モーダルを表示し、認証後に元クリックを再実行
 * 4) Shadow DOM を貫通して Merge ボタンに「⚡ Thunder Protected」バッジを付与
 *
 * 依存（先に読み込まれた content script が self.BTCI に載せている）:
 *   getPrKeyFromPathname, findMergeElementFromPath, isMergeButtonText,
 *   getButtonText, isDisabled, isCandidate, CANDIDATE_SELECTOR,
 *   isVerified, markVerified, showThunderCaptcha, celebrate, notifyLauncher
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
    // composedPath() で Shadow DOM 内も含めたクリック経路から Merge 要素を探す
    var path =
      typeof event.composedPath === "function" ? event.composedPath() : [];
    var mergeEl = BTCI.findMergeElementFromPath(path);

    // フォールバック（composedPath 非対応や空の場合）
    if (!mergeEl && BTCI.findMergeElement) {
      mergeEl = BTCI.findMergeElement(event.target);
    }
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

  // ===== バッジ付与（Shadow DOM 貫通） =====

  // バッジは shadow root 内にも置かれうるが、注入 CSS は document スコープ
  // までしか効かないため、見た目を保つために必須スタイルをインラインで当てる。
  var BADGE_CSS =
    "display:inline-flex;align-items:center;gap:4px;margin-left:8px;" +
    "padding:2px 8px;border-radius:999px;font-size:11px;font-weight:800;" +
    "line-height:1.6;white-space:nowrap;vertical-align:middle;" +
    "background:#0a0a0a;color:rgb(255,211,0);" +
    "border:1px solid rgb(255,211,0);box-shadow:0 0 0 1px rgb(230,0,18);";

  function addBadge(el) {
    if (!el || el.getAttribute("data-bt-ci-badged") === "1") return;
    if (BTCI.isDisabled(el)) return;
    if (!BTCI.isMergeButtonText(BTCI.getButtonText(el))) return;

    el.setAttribute("data-bt-ci-badged", "1");

    var badge = document.createElement("span");
    badge.className = "bt-ci-badge";
    badge.style.cssText = BADGE_CSS; // shadow DOM 内でも崩れないように
    badge.textContent = "⚡ Thunder Protected";

    var tag = (el.tagName || "").toLowerCase();
    if (tag === "input") {
      // input には子要素を append できないので隣に挿入
      el.insertAdjacentElement("afterend", badge);
    } else {
      el.appendChild(badge);
    }
  }

  // 既に MutationObserver を付けた root を記録（重複監視防止）
  var observedRoots = new WeakSet();
  var observer = new MutationObserver(function () {
    scheduleScan();
  });

  /**
   * document と、そこにぶら下がる全 shadow root を再帰的に visit する。
   * @param {Document|ShadowRoot} root
   * @param {(root: Document|ShadowRoot) => void} visit
   */
  function walkRoots(root, visit) {
    if (!root) return;
    visit(root);
    var els = root.querySelectorAll ? root.querySelectorAll("*") : [];
    for (var i = 0; i < els.length; i++) {
      if (els[i].shadowRoot) walkRoots(els[i].shadowRoot, visit);
    }
  }

  function scanAndObserve() {
    walkRoots(document, function (root) {
      // バッジ付与
      var nodes = root.querySelectorAll(BTCI.CANDIDATE_SELECTOR);
      for (var i = 0; i < nodes.length; i++) addBadge(nodes[i]);
      // この root をまだ監視していなければ監視開始（shadow root も含む）
      if (!observedRoots.has(root)) {
        observedRoots.add(root);
        var target = root === document ? document.body : root;
        if (target) {
          observer.observe(target, { childList: true, subtree: true });
        }
      }
    });
  }

  var rafPending = false;
  function scheduleScan() {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      scanAndObserve();
    });
  }

  function start() {
    scanAndObserve();
    // GitHub は Turbo ナビゲーションや遅延描画で後から merge box を差し込むため、
    // 念のため数秒間は軽くポーリングして shadow root の出現も拾う。
    var ticks = 0;
    var iv = setInterval(function () {
      scheduleScan();
      if (++ticks >= 10) clearInterval(iv); // 約 5 秒
    }, 500);
  }

  if (document.body) {
    start();
  } else {
    document.addEventListener("DOMContentLoaded", start, { once: true });
  }
})();
