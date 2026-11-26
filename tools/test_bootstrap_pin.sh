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

# The APK must direct setup to the owner fork, even when Hermes is installed already.
activity="$here/android/src/com/omarqaterge/hermesmobile/MainActivity.java"
grep -Fq 'https://raw.githubusercontent.com/tahershawki1/hermes-mobile-app/main/phone/bootstrap.sh' "$activity"
grep -Fq 'HM_MOBILE_REF=' "$activity"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
eval "$(sed -n '/^hermes_source_matches() {/p' "$here/phone/bootstrap.sh")"
engine="$work/agent"
HERMES_REPO=https://github.com/tahershawki1/hermes-agent.git
git init -q "$engine"
git -C "$engine" -c user.name=Test -c user.email=test@example.invalid commit -q --allow-empty -m pinned
HERMES_COMMIT=$(git -C "$engine" rev-parse HEAD)
touch "$engine/install-stamp.json"
hermes() { echo "Hermes test"; }
deb() { eval "$1"; }
git -C "$engine" remote add origin https://github.com/NousResearch/hermes-agent.git
if hermes_source_matches; then echo 'FAIL: upstream install passed the owner check'; exit 1; fi
git -C "$engine" remote set-url origin "$HERMES_REPO"
hermes_source_matches
HERMES_COMMIT=0000000000000000000000000000000000000000
if hermes_source_matches; then echo 'FAIL: unpinned install passed the owner check'; exit 1; fi
echo 'bootstrap owner-source checks: OK'
