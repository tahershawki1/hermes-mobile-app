## Standalone Hermes engine

`engine/` is the self-contained Hermes source used by Hermes Mobile. It is based on the pinned upstream commit in
`compatibility/hermes-engine.json`, with the former mobile fixes merged directly into the source. Existing installs also
receive the compatibility patches in `hermes/patches/`; new image builds apply them before packaging.

The phone installer restarts Hermes after installation so the integrated engine changes and compatibility patches load. Keep
`engine/`, `hermes/patches/` and `compatibility/hermes-engine.json` synchronized when updating the engine. Run the engine
tests and mobile contract tests before committing an update.
