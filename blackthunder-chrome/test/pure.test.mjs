/*
 * ThunderCaptcha — 純粋関数の依存ゼロテスト。
 * 実行: node blackthunder-chrome/test/pure.test.mjs
 *
 * 各モジュールは dual-export なので createRequire で CommonJS として読む。
 */
import { createRequire } from "node:module";
import assert from "node:assert/strict";

const require = createRequire(import.meta.url);
const { getPrKeyFromPathname } = require("../src/content/pr-key.js");
const { isMergeButtonText } = require("../src/content/merge-detect.js");
const { buildVerificationStorageKey, isVerificationFresh } = require(
  "../src/content/verification.js"
);

let passed = 0;
function it(name, fn) {
  fn();
  passed++;
  console.log("  ok -", name);
}

console.log("getPrKeyFromPathname");
it("PR ページのパスから owner/repo#n を作る", () => {
  assert.equal(getPrKeyFromPathname("/owner/repo/pull/123"), "owner/repo#123");
});
it("サブパス付きでも PR 番号まで", () => {
  assert.equal(
    getPrKeyFromPathname("/octocat/Hello-World/pull/42/files"),
    "octocat/Hello-World#42"
  );
});
it("PR 以外のパスは null", () => {
  assert.equal(getPrKeyFromPathname("/owner/repo/issues/1"), null);
  assert.equal(getPrKeyFromPathname("/"), null);
  assert.equal(getPrKeyFromPathname(undefined), null);
});

console.log("isMergeButtonText");
it("英語 Merge 系文言を拾う", () => {
  assert.equal(isMergeButtonText("Merge pull request"), true);
  assert.equal(isMergeButtonText("Squash and merge"), true);
  assert.equal(isMergeButtonText("Rebase and merge"), true);
  assert.equal(isMergeButtonText("Confirm squash and merge"), true);
  assert.equal(isMergeButtonText("Enable auto-merge"), true);
});
it("日本語 UI 文言を拾う", () => {
  assert.equal(isMergeButtonText("マージ"), true);
  assert.equal(isMergeButtonText("スカッシュとマージ"), true);
  assert.equal(isMergeButtonText("リベースしてマージ"), true);
});
it("無関係なテキスト・自前バッジは拾わない", () => {
  assert.equal(isMergeButtonText("Close pull request"), false);
  assert.equal(isMergeButtonText("Comment"), false);
  assert.equal(isMergeButtonText("⚡ Thunder Protected"), false);
  assert.equal(isMergeButtonText(""), false);
  assert.equal(isMergeButtonText(null), false);
});

console.log("buildVerificationStorageKey");
it("PR key に prefix を付ける", () => {
  assert.equal(
    buildVerificationStorageKey("owner/repo#123"),
    "bt-ci:verified:owner/repo#123"
  );
});

console.log("isVerificationFresh");
it("TTL 内は true / 超過は false", () => {
  const now = 1_000_000;
  assert.equal(isVerificationFresh(now - 5_000, 30_000, now), true);
  assert.equal(isVerificationFresh(now - 30_001, 30_000, now), false);
  assert.equal(isVerificationFresh(now + 1, 30_000, now), false); // 未来は無効
  assert.equal(isVerificationFresh("nan", 30_000, now), false);
});

console.log(`\n✅ all ${passed} checks passed`);
