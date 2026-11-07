# Owner-controlled engine source

- Phone bootstrap and migration now install from `tahershawki1/hermes-agent`.
- Upstream synchronization is isolated to the engine repository workflow.
- Existing checkouts are redirected without deleting their working tree; legacy patches remain a migration guard.
- The tested commit and rollback policy are recorded in `compatibility/hermes-engine.json`.

Verified with `tools/test_bootstrap_pin.sh` and shell syntax checks.
