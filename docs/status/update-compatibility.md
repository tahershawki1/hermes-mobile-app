# Installed upstream APK: update compatibility gate

Verified from development source (2026-11-02):
- Android package: `com.omarqaterge.hermesmobile` (AndroidManifest.xml).
- Build script signs with `KEYSTORE` or a locally generated `~/.android/hermes-mobile.keystore`; the generated key is not automatically the upstream release key.
- Release workflow expects `KEYSTORE_B64` secret, and documents that every release must use the same key for updates.
- Default build versionCode is 1; release tags derive versionCode from semantic version numbers.
- Android manifest sets `allowBackup=false`.

## Gate before replacing an installed upstream APK

1. Obtain the *exact installed APK's* signing certificate SHA-256 and installed versionCode from the device (e.g. `adb shell dumpsys package com.omarqaterge.hermesmobile` for version; `adb shell pm path com.omarqaterge.hermesmobile` and `adb pull` of the base APK for `apksigner verify --print-certs`).
2. Build the candidate APK and record `apksigner verify --print-certs <candidate.apk>` plus `aapt dump badging <candidate.apk>` (or equivalent).
3. Confirm package ID matches, certificate signing lineage is compatible, and candidate versionCode is not lower than installed versionCode.
4. Confirm installed app state and Termux/Debian data have a recovery plan before installing.
5. Only then attempt `adb install -r <candidate.apk>` and verify data retention and app operation. Do **not** uninstall the upstream app as a workaround for a signature mismatch.

If upstream's signing key or an authorized signing lineage is unavailable, a direct in-place update from this fork is not supported. Use a separately named application only after auditing all package-name-dependent integrations, or keep the official app installed.

## Status
- [x] Source package ID verified.
- [x] Build and release signing mechanisms inspected.
- [ ] Installed APK certificate and versionCode measured on user's phone.
- [ ] Candidate APK built and its certificate/versionCode measured.
- [ ] Compatibility verified and update tested without data loss.

No private signing keys or user device data should be committed to GitHub.
