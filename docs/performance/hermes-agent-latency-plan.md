# Hermes agent latency optimization (2026-11-07)

## Baseline (measured on handset, 2026-11-05)
- Caveman skill evaluation: 56.6 s wall time, five model calls (39.1 s total), four tool rounds.
- Prompt input expanded from ~13.3k to ~42k tokens.
- Historical failures include 402/429 retries, 732.5 s local Qwen stream drop, and a 32k compression context configuration against a 64k requirement.
- These are historical observations, **not a new benchmark**.

## Scope and ownership
The Android app is a frontend. Agent loop, model calls, tool scheduling, prompt construction and compression live in the Hermes Python installation inside Debian/Termux. **Do not claim a frontend change fixes agent latency.** The Python runtime must be inspected and patched in its actual upstream/source location, then deployed to the phone with a rollback.

## Implementation order
1. Instrument each turn with monotonic timings: first-token, provider total, tool queue/run, prompt build, compression, retries, total wall time; record token counts and cache hit metrics. Never persist prompt bodies, secrets or raw tool output in telemetry.
2. Introduce an opt-in adaptive task policy: short factual/installed-skill checks use local skill index and one model planning round where possible; retain deep mode for coding and multi-step tasks. No unconditional hard cap on tool rounds.
3. Cache the skill manifest by filesystem mtime/hash and invalidate on install/edit/remove; do not cache permission decisions or stale tool results.
4. Parallelize **only independent, read-only** tool calls with bounded concurrency and stable result ordering; serialize mutations and approval-gated actions.
5. Reduce redundant prompt content with bounded tool-output excerpts and references to full logs; retain task-critical evidence and explicit user instructions.
6. Provider resilience: classify 402 as non-retryable until credentials/billing change; honor 429 Retry-After with a bounded retry budget; set configurable connect/read/stream-idle timeouts and cancellable fallback. Do not silently change the user's selected paid provider or subscription.
7. Check compression model's true context capability and avoid incompatible 32k configuration; test loss of instructions after compression.
8. Keep the Shizuku bridge and Debian process warm where practical without introducing permanent wake locks or high idle battery drain.

## Acceptance gates
- Re-run the **same** Caveman question three times with same provider/model, cold and warm skill cache, recording median and p95 where sample size allows.
- Compare answer correctness, cited sources, tool count, provider latency, prompt tokens and wall time.
- Run a multi-file programming task to verify no quality regression or unsafe parallel writes.
- Test 402, 429, network disconnect, cancellation, provider fallback, skill-index invalidation, and 32k context boundary.
- Verify Android battery idle impact, Termux/Debian startup and Shizuku functionality.
- Target Caveman <=25 s median **as a goal, not a promise**. Never publish an APK to fix Python-only runtime changes.
- Roll back if task correctness drops or crash/retry rate increases.

## Current state
- [x] Baseline and repository architecture inspected.
- [ ] Python agent runtime source located and profiled on-device.
- [ ] Runtime optimizations implemented and tested.
- [ ] Benchmarks measured after patch.
- [ ] Changes deployed to handset.
