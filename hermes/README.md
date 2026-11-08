## Standalone Hermes engine

`engine/` is the self-contained Hermes source used by Hermes Mobile. It is based on the pinned upstream commit in
`compatibility/hermes-engine.json`, with the former mobile fixes merged directly into the source. Runtime installation
does not clone an upstream checkout and does not apply patches.

The phone installer restarts Hermes after installation so the integrated engine changes load. Keep `engine/` and
`compatibility/hermes-engine.json` synchronized when updating the engine. Run the engine tests and mobile contract tests
before committing an update.
