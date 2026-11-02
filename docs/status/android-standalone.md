# Hermes Mobile: Termux-based development checklist

Decision (2026-11-02): Keep the existing Termux + Debian runtime. The user confirms it works well and does not require a standalone APK. Preserve this architecture; do not migrate or remove Termux unless explicitly requested later.

# Hermes Android standalone: implementation checklist

Updated goal: Improve reliability, security, battery usage, Android integration and optionally local AI inference while retaining Termux + Debian. Keep upstream attribution and MIT license.

## Progress
- [x] Fork verified at tahershawki1/hermes-mobile-app; upstream LICENSE preserved.
- [x] Dedicated development branch created.
- [x] Initial inspection of phone/bootstrap.sh, phone/install.sh, android/AndroidManifest.xml, android/build.sh, hermes/README.md, AGENTS.md and tools/check.sh.
- [x] Identified direct Termux and Debian dependencies and pinned Hermes revision.
- [ ] Audit complete runtime dependencies, native libraries, Android process constraints and license obligations (in progress: Debian image, supervisor and CI inspected).
- [x] Configure CI to trigger on development pushes (verified workflow file change).
- [ ] Verify actual CI run results and APK build on development branch.
- [ ] Audit the current Termux + Debian setup, restart behavior and error handling.
- [ ] Improve reliability and battery use without breaking the existing supervisor.
- [ ] Evaluate and integrate optional local LLM inference through the existing runtime; measure RAM and latency.
- [ ] Test file access, voice, notifications, lifecycle and offline inference (if implemented) on real Android 17 hardware.
- [ ] Security review, regression tests, signing and release candidate.

## Verified architecture observations
- phone/bootstrap.sh uses Termux shell, installs proot-distro Debian or root-only chroot-distro, and pins Hermes to b8a8be185d6e88b35e0a4fa794fea64fb06ed85b.
- phone/install.sh copies the plugin into /root/.hermes inside Debian and uses Termux to supervise the process.
- AndroidManifest.xml requests com.termux.permission.RUN_COMMAND and declares com.termux, com.termux.api and com.termux.boot package visibility.
- android/build.sh builds a Java/WebView APK via aapt2, javac, d8, zipalign and apksigner; it currently packages the UI and some native speech libraries, not a complete Hermes runtime.
- hermes/README.md documents patches against a pinned upstream Hermes build; migration must retain compatibility.
- tools/check.sh and AGENTS.md require spec updates and tests for behavioral changes.

## Decisions and safeguards
- The Termux + Debian dependency is intentional and accepted; no standalone-runtime migration is planned.
- Do not modify main directly. Preserve upstream MIT copyright notices and third-party licenses.
- Avoid hardcoded credentials, private phone data or signing keys in git.
- Do not remove existing Termux path until embedded execution passes functional tests.
- Treat Android background execution, process limits and native binary compatibility as unverified until tested.
- A local agent runtime does not imply offline inference; model weights and inference engine are separate deliverables.

## Additional verified findings
- tools/build-image.sh produces a Debian trixie ARM64 rootfs archive and verifies Chromium and pinned Hermes inside a Linux container. It is not an Android app-private runtime and cannot simply be copied into an APK and executed as-is.
- phone/hermes-services launches a proot/chroot dashboard, cron ticker, optional memory sync and an app keeper. Each requires a lifecycle replacement or compatibility layer.
- .github/workflows/ci.yml triggers on pushes to main and on pull requests, not direct pushes to development. No successful baseline run has yet been verified.
- A rootfs archive may require significant storage: bootstrap.sh currently reserves 5200 MB for image restore. This is not the eventual APK size.

## Next action
Check baseline CI and APK build; audit the existing Termux/ Debian service lifecycle, restart behavior, battery impact and permissions. Do not prototype an embedded runtime.

## Verification log
2026-11-02: GitHub connector successfully read the fork's README.md, LICENSE and AGENTS.md; created development branch. Read source files listed above. No APK build or device test has been executed in this workstream.
2026-11-02: Reviewed tools/build-image.sh, phone/hermes-services and .github/workflows/ci.yml. Recorded image, supervisor and CI trigger limitations. No runtime compatibility claim or CI success asserted.
2026-11-02: User confirmed the existing Termux-based implementation works and should be retained. Standalone migration tasks cancelled; focus shifted to maintenance, optimization, security and optional local inference.

2026-11-02: CI workflow push trigger changed from [main] to [main, development] on development branch, commit 684b9185. Fetched workflow again to verify the change. No workflow success or APK artifact has been confirmed. Reviewed phone/hermes-debian and phone/hermes-services for service lifecycle audit.
