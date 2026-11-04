# Camera, attachment-only messages and compact thinking

**State:** Camera URI authority now follows the installed app ID. Composer and gateway accept attachment-only messages. Large animation summary removed; waiting and thinking use a small face.

**Next:** Review PR CI before merging. Local production build, all 434 unit tests, targeted browser checks (02,25), spec/changelog checks and CameraProvider compilation passed. Initial CI compiled Android and passed API checks; its obsolete release.yml guard was redirected to build-taher.yml, with the same production APK resource check restored there.

**Needs a real phone:** Capture a photo, verify its preview, send it without text, and share a sent image in the Taher build.

**Links:** `docs/spec/03-04-composer.md`, `docs/spec/03-02-chat-screen.md`, `docs/spec/04-01-every-java-class.md`.
