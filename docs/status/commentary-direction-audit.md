# Commentary and mixed-language direction audit

Baseline: `d3f7eaa67aa905fd4f024687f77e532b5f93f8ec`. Local working-copy changes only; no commit, push, APK installation or running-engine changes.

## Confirmed causes

- `tui_gateway/prompt_turn.py` emits `message.interim`, while the mobile event switch ignored that event. A real-client event regression reproduced missing non-streamed commentary; a second regression reproduced an unsealed streamed segment. The working copy now handles the segment boundary without ending the turn.
- Finalization must also honor `response_previewed` and `response_transformed`. Tests reproduced duplicate previewed final text and retained untransformed streamed text; the working copy addresses those cases.
- `rehypeTextDirection` assigns `dir=ltr` to code, but the custom Markdown code renderer discarded it. Chromium showed an RTL list/blockquote whose child paragraph became LTR after an English code prefix. Preserving the DOM attribute made those child paragraphs RTL while code remained LTR. Ordinary unmarked English-first prose remains LTR under Auto by design; a fixed RTL reading preference already exists.

## Verification and remaining gates

- Final focused mobile tests after review correction: 37 passed across gateway events, direction transform, and real Markdown-component regressions. Transformed sealed previews, empty transformed finals, missing-preview fallback, previous-user identity and tool/subagent boundaries are covered.
- Engine callback wiring: existing test passed in an isolated test home/venv.
- Real Chromium component check: paragraph/list/blockquote directions inspected; no physical Android device available via ADB.
- Full web suite on final source after review correction: serial re-run completed exit 0, 473 tests passed in 48 test files, no failures/pending tests. An earlier pre-review run passed 463 tests; parallel attempts hit timeouts, so final coverage uses the completed serial run with larger time budgets.
- Updated browser e2e assertions in `25-text-direction.cjs`; complete e2e runner not yet executed.
- Actual latency attribution, installed APK/engine/plugin identity and foreground/background behavior still require a controlled phone trace.
- Initial independent review found a sealed-preview reconciliation issue, corrected through a RED/GREEN cycle. Final independent review passed with no blocking security or logic issues; test-only suggestions remain.
- Added `27-interim-commentary.cjs` to exercise real WebSocket delivery and visible progress before held completion in the built UI; its first complete runner verification is delegated to CI.

## Deployment caution

`phone/install.sh` changes the installed engine's origin and applies compatibility patches; it does not copy the whole vendored engine into an existing install. `bootstrap.sh` skips engine installation when an install stamp and a working version exist. Source edits in `hermes/engine` alone therefore do not prove that an existing phone loaded them.
