#!/usr/bin/env bash
# The Hermes that bootstrap.sh installs must be the one the app vendors (web/vendor/hermes-shared/.hermes-commit).
set -eu
here=$(cd "$(dirname "$0")/.." && pwd)
pin=$(tr -d '[:space:]' < "$here/web/vendor/hermes-shared/.hermes-commit")
full=$(sed -n 's/^HERMES_COMMIT=\([0-9a-f]\{40\}\).*/\1/p' "$here/phone/bootstrap.sh")
[ -n "$full" ] || { echo "FAIL: bootstrap.sh has no 40-char HERMES_COMMIT=…"; exit 1; }
case "$full" in "$pin"*) echo "bootstrap pin: OK ($full)";; *) echo "FAIL: bootstrap pins $full, the app vendors $pin"; exit 1;; esac
grep -Eq -- '--commit \\?"?\$HERMES_COMMIT' "$here/phone/bootstrap.sh" || { echo "FAIL: installer not called with --commit"; exit 1; }
for f in "$here/phone/bootstrap.sh" "$here/phone/install.sh" "$here/tools/hermes-contract/start-hermes.sh" "$here/tools/test_hermes_patches.sh"; do
  grep -q 'tahershawki1/hermes-agent' "$f" || { echo "FAIL: $f does not use the owner-controlled engine repository"; exit 1; }
done
grep -q 'NousResearch/hermes-agent' "$here/phone/bootstrap.sh" && { echo "FAIL: bootstrap still uses upstream at runtime"; exit 1; } || true
