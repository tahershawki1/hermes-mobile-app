- **Owner-controlled engine source.** Phone bootstrap and migration use `tahershawki1/hermes-agent`; upstream synchronization is isolated to the engine repository, and older checkouts retain a safe legacy patch migration path.

Verified with `tools/test_bootstrap_pin.sh`, `python3 tools/check_spec.py`, shell syntax checks, and web typecheck.
