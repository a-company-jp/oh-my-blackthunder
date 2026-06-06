/*
 * ThunderCaptcha — 認証モーダル（reCAPTCHA 風パロディ）
 *
 * showThunderCaptcha() を呼ぶと Promise を返す。
 *   - 認証成功（ザクザク認証してMerge）→ resolve(true)
 *   - 中断（まだ食べていません / Esc）         → resolve(false)
 *
 * DOM 依存のためブラウザでのみ動作。self.BTCI に載せる。
 */
(function (root) {
  "use strict";

  var STEPS = ["⚡ 糖分認証中...", "🍫 ザクザク確認中...", "✅ Thunder Verified"];
  var STEP_MS = 600;

  function el(tag, className, text) {
    var n = document.createElement(tag);
    if (className) n.className = className;
    if (text != null) n.textContent = text;
    return n;
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
      var overlay = el("div", "bt-ci-overlay");
      var modal = el("div", "bt-ci-modal");
      overlay.appendChild(modal);

      var title = el("div", "bt-ci-title", "⚡ BLACK THUNDER CAPTCHA");
      var lead = el("div", "bt-ci-lead", "Merge前の糖分確認です。");
      var question = el(
        "div",
        "bt-ci-question",
        "あなたは本当にブラックサンダーを食べましたか？"
      );

      // reCAPTCHA 風チェックボックス行
      var checkRow = el("label", "bt-ci-check");
      var checkbox = el("input", "bt-ci-checkbox");
      checkbox.type = "checkbox";
      var checkBox = el("span", "bt-ci-checkbox-box");
      var checkLabel = el(
        "span",
        "bt-ci-check-label",
        "私は黒い雷神を体内にデプロイしました"
      );
      var checkLogo = el("span", "bt-ci-check-logo", "🍫⚡");
      checkRow.appendChild(checkbox);
      checkRow.appendChild(checkBox);
      checkRow.appendChild(checkLabel);
      checkRow.appendChild(checkLogo);

      var notice = el(
        "div",
        "bt-ci-notice",
        "食べていない場合、Mergeできません。"
      );

      var status = el("div", "bt-ci-status");
      status.style.display = "none";

      var actions = el("div", "bt-ci-actions");
      var cancelBtn = el("button", "bt-ci-btn bt-ci-btn-cancel", "まだ食べていません");
      cancelBtn.type = "button";
      var okBtn = el(
        "button",
        "bt-ci-btn bt-ci-btn-ok",
        "ザクザク認証してMerge"
      );
      okBtn.type = "button";
      okBtn.disabled = true; // チェックされるまで無効
      actions.appendChild(cancelBtn);
      actions.appendChild(okBtn);

      modal.appendChild(title);
      modal.appendChild(lead);
      modal.appendChild(question);
      modal.appendChild(checkRow);
      modal.appendChild(notice);
      modal.appendChild(status);
      modal.appendChild(actions);

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
        }
      }

      checkbox.addEventListener("change", function () {
        okBtn.disabled = !checkbox.checked;
        checkRow.classList.toggle("bt-ci-checked", checkbox.checked);
      });

      cancelBtn.addEventListener("click", function () {
        cleanup(false);
      });

      okBtn.addEventListener("click", function () {
        if (okBtn.disabled) return;
        // 多重クリック防止
        okBtn.disabled = true;
        cancelBtn.disabled = true;
        checkbox.disabled = true;
        status.style.display = "block";
        runSteps(0);
      });

      function runSteps(i) {
        if (i >= STEPS.length) {
          cleanup(true);
          return;
        }
        status.textContent = STEPS[i];
        status.classList.toggle("bt-ci-status-done", i === STEPS.length - 1);
        setTimeout(function () {
          runSteps(i + 1);
        }, STEP_MS);
      }

      // overlay 外クリックでは閉じない（クリックを飲み込むだけ）
      overlay.addEventListener("click", function (e) {
        if (e.target === overlay) {
          e.preventDefault();
          e.stopPropagation();
        }
      });

      document.addEventListener("keydown", onKey, true);
      document.body.appendChild(overlay);
      checkbox.focus();
    });
  }

  root.BTCI = Object.assign(root.BTCI || {}, {
    showThunderCaptcha: showThunderCaptcha
  });
})(typeof self !== "undefined" ? self : this);
