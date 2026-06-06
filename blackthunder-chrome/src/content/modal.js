/*
 * ThunderCaptcha — 認証モーダル（reCAPTCHA v2 チェックボックス風パロディ）
 *
 * showThunderCaptcha() を呼ぶと Promise を返す。
 *   - 認証成功（チェックボックスを押す）→ resolve(true)
 *   - 中断（Esc）                        → resolve(false)
 *
 * 見た目は reCAPTCHA v2 の「私はロボットではありません」ウィジェットに寄せ、
 * 配色はブラックサンダー（黒×金×赤）。右のロゴはブラックサンダーに差し替え。
 *
 * DOM 依存のためブラウザでのみ動作。self.BTCI に載せる。
 */
(function (root) {
  "use strict";

  // チェック後の演出ステップ（ローディング → 確認済み）。
  var LOADING_MS = 1100; // グルグル表示時間
  var DONE_MS = 700; // ✅ を見せてから閉じるまで

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
  }

  function assetUrl(path) {
    try {
      return chrome.runtime.getURL(path);
    } catch (e) {
      return "";
    }
  }

  // reCAPTCHA 風に「線を描く」チェックマーク（SVG）。
  // CSS 側で stroke-dashoffset をアニメートして描画する。
  function makeCheckSvg() {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    svg.setAttribute("class", "bt-ci-check-svg");
    svg.setAttribute("viewBox", "0 0 30 30");
    var poly = document.createElementNS(ns, "polyline");
    poly.setAttribute("points", "7,15.5 13,21 23,9");
    svg.appendChild(poly);
    return svg;
  }

  /**
   * @returns {Promise<boolean>} 認証されたら true
   */
  function showThunderCaptcha() {
    return new Promise(function (resolve) {
      // 既に出ているなら二重表示しない
      if (document.querySelector(".bt-ci-overlay")) {
        resolve(false);
        return;
      }

      var settled = false;
      var state = "idle"; // idle -> loading -> checked

      var overlay = el("div", "bt-ci-overlay");
      var widget = el("div", "bt-ci-widget");
      widget.setAttribute("role", "checkbox");
      widget.setAttribute("aria-checked", "false");
      widget.tabIndex = 0;

      // 左：四角いチェックボックス（グルグル / ✓ を内部で出す）
      var box = el("div", "bt-ci-box");

      // 中央：ラベル
      var label = el("div", "bt-ci-label", "私はブラックサンダーを食べました");

      // 右：ブランド（ロゴ + 名前 + 規約）
      var brand = el("div", "bt-ci-brand");
      var logoUrl = assetUrl("src/assets/logo.png");
      if (logoUrl) {
        var img = el("img", "bt-ci-brand-logo");
        img.src = logoUrl;
        img.alt = "Black Thunder";
        img.draggable = false;
        img.addEventListener("error", function () {
          var fb = el(
            "div",
            "bt-ci-brand-logo bt-ci-brand-logo-fallback",
            "🍫⚡"
          );
          if (img.parentNode) img.parentNode.replaceChild(fb, img);
        });
        brand.appendChild(img);
      } else {
        brand.appendChild(
          el("div", "bt-ci-brand-logo bt-ci-brand-logo-fallback", "🍫⚡")
        );
      }
      brand.appendChild(el("div", "bt-ci-brand-name", "ThunderCaptcha"));
      brand.appendChild(el("div", "bt-ci-brand-terms", "プライバシー・規約"));

      widget.appendChild(box);
      widget.appendChild(label);
      widget.appendChild(brand);

      // ウィジェット下のステータス行
      var status = el("div", "bt-ci-status");
      status.style.visibility = "hidden";

      var stack = el("div", "bt-ci-stack");
      stack.appendChild(widget);
      stack.appendChild(status);
      overlay.appendChild(stack);

      function cleanup(result) {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey, true);
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        resolve(result);
      }

      function onKey(e) {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          cleanup(false);
        } else if (
          (e.key === "Enter" || e.key === " " || e.key === "Spacebar") &&
          state === "idle"
        ) {
          e.preventDefault();
          verify();
        }
      }

      function verify() {
        if (state !== "idle") return;
        state = "loading";
        box.classList.add("bt-ci-box-loading");
        status.style.visibility = "visible";
        status.classList.remove("bt-ci-status-done");
        status.textContent = "🍫 ザクザク確認中...";

        setTimeout(function () {
          box.classList.remove("bt-ci-box-loading");
          box.classList.add("bt-ci-box-checked");
          box.appendChild(makeCheckSvg());
          widget.setAttribute("aria-checked", "true");
          state = "checked";
          status.classList.add("bt-ci-status-done");
          status.textContent = "✅ Thunder Verified";
          setTimeout(function () {
            cleanup(true);
          }, DONE_MS);
        }, LOADING_MS);
      }

      widget.addEventListener("click", function () {
        verify();
      });

      // overlay 外クリックでは閉じない（クリックを飲み込むだけ）
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay || e.target === stack) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(overlay);
      widget.focus();
    });
  }

  root.BTCI = Object.assign(root.BTCI || {}, {
    showThunderCaptcha: showThunderCaptcha
  });
})(typeof self !== "undefined" ? self : this);
