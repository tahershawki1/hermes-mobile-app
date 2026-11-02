# Hermes Android standalone: implementation checklist

Goal: Run the Hermes agent runtime, memory, tools and optionally a local LLM within the Android app, without requiring an external Termux installation or remote server. Keep upstream attribution and MIT license.

## Progress
- [x] Fork verified at tahershawki1/hermes-mobile-app; upstream LICENSE preserved.
- [x] Dedicated development branch created.
- [x] Initial inspection of phone/bootstrap.sh, phone/install.sh, android/AndroidManifest.xml, android/build.sh, hermes/README.md, AGENTS.md and tools/check.sh.
- [x] Identified direct Termux and Debian dependencies and pinned Hermes revision.
- [ ] Audit complete runtime dependencies, native libraries, Android process constraints and license obligations (in progress: Debian image, supervisor and CI inspected).
- [ ] Establish baseline CI and APK build result on development branch.
- [ ] Build an isolated ARM64 Python/runtime feasibility prototype in the app sandbox.
- [ ] Run Hermes CLI and plugin in the embedded runtime without Termux.
- [ ] Replace Termux command bridge with an Android IPC/service bridge.
- [ ] Integrate local LLM inference (GGUF/llama.cpp), measure RAM and latency.
- [ ] Test file access, voice, notifications, lifecycle and offline behavior on real Android 17 hardware.
- [ ] Security review, regression tests, signing and release candidate.

## Verified architecture observations
- phone/bootstrap.sh uses Termux shell, installs proot-distro Debian or root-only chroot-distro, and pins Hermes to b8a8be185d6e88b35e0a4fa794fea64fb06ed85b.
- phone/install.sh copies the plugin into /root/.hermes inside Debian and uses Termux to supervise the process.
- AndroidManifest.xml requests com.termux.permission.RUN_COMMAND and declares com.termux, com.termux.api and com.termux.boot package visibility.
- android/build.sh builds a Java/WebView APK via aapt2, javac, d8, zipalign and apksigner; it currently packages the UI and some native speech libraries, not a complete Hermes runtime.
- hermes/README.md documents patches against a pinned upstream Hermes build; migration must retain compatibility.
- tools/check.sh and AGENTS.md require spec updates and tests for behavioral changes.

## Decisions and safeguards
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
Finish native/Python dependency inventory; check baseline CI via PR or workflow execution; prototype a minimal ARM64 embedded runtime without changing the production launcher.

## Verification log
2026-11-02: GitHub connector successfully read the fork's README.md, LICENSE and AGENTS.md; created development branch. Read source files listed above. No APK build or device test has been executed in this workstream.
2026-11-02: Reviewed tools/build-image.sh, phone/hermes-services and .github/workflows/ci.yml. Recorded image, supervisor and CI trigger limitations. No runtime compatibility claim or CI success asserted.
