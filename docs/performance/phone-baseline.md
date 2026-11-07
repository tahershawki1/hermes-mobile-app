# Running the Hermes latency baseline on the phone

The read-only analyzer in `tools/hermes_latency_summary.py` can inspect a local Hermes log. It prints **aggregate counts only**; never upload a raw agent log, because logs can contain prompts and secrets.

In Termux (using a checkout of this branch), first locate the agent log **inside Debian**:

```bash
~/bin/hermes-debian bash -lc 'find /root/.hermes -name agent.log -type f 2>/dev/null | head -20'
```

Run the analyzer inside Debian against the chosen file:

```bash
~/bin/hermes-debian python3 /root/.hermes/hermes-agent/tools/hermes_latency_summary.py /path/to/agent.log
```

If the Hermes checkout does not contain this fork's `tools/` directory, copy the analyzer from this repository using `~/bin/hermes-debian --put` and use its destination path instead. Do not assume the Android repository and the Python agent repository are the same checkout.

**Limitations:** this is an offline baseline helper, not a live profiler. Regex durations may mix tool and model timings and cannot establish full turn latency without correlated IDs. Never use these aggregates alone to claim a speedup. Future agent-runtime changes must add monotonic per-turn instrumentation, benchmarks and rollback tests.

**Existing optimization:** `hermes/patches/0003-perf-yaml-reuse-a-per-thread-reader-in-safe_load.patch` already addresses the YAML parsing bottleneck; avoid duplicating it. Its documented phone benchmark is 1.80 s to 0.49 s for an uncached skill scan. Check patch status on the installed build before claiming it is active.
