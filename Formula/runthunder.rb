# typed: false
# frozen_string_literal: true

# RunThunder Homebrew formula (fallback copy committed in-repo).
#
# The release workflow (.github/workflows/runthunder-release.yml) regenerates this
# file on every published GitHub Release and (when HOMEBREW_TAP_TOKEN is set) pushes
# it to the external tap a-company-jp/homebrew-tap as Formula/runthunder.rb.
#
# The url/sha256/version below are filled in automatically per release. The values
# committed here point at the latest known release; if you are reading this before
# the first automated release, run the workflow (or publish a release) to populate them.
class Runthunder < Formula
  desc "RunCat-style macOS menu-bar app with a Black Thunder character (CPU/MEM/NET, Claude usage)"
  homepage "https://github.com/a-company-jp/oh-my-blackthunder"
  # Replaced automatically by the release workflow with the real release tarball URL.
  url "https://github.com/a-company-jp/oh-my-blackthunder/releases/download/v0.0.0/RunThunder-0.0.0-macos.tar.gz"
  sha256 "0000000000000000000000000000000000000000000000000000000000000000"
  version "0.0.0"

  depends_on :macos

  def install
    bin.install "RunThunder"
  end

  def caveats
    <<~EOS
      RunThunder is a menu-bar (LSUIElement) app. Launch it from the binary:

        runthunder

      It lives in the macOS menu bar (no Dock icon). To run it at login,
      use the app's own "ログイン時に起動" (Launch at Login) toggle, or add
      #{HOMEBREW_PREFIX}/bin/runthunder to your login items.
    EOS
  end

  test do
    assert_predicate bin/"RunThunder", :executable?
  end
end
