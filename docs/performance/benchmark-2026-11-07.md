# Phone benchmark report (2026-11-07)

This is a harness before/after run on the connected phone through Shizuku (`rish`). No Hermes Mobile APK or Hermes engine revision was changed between the two measurements; therefore this is not evidence of a product performance improvement. It is a reproducibility capture of the installed service under two sampling windows.

Both phases used 10 runs, 300 ms pause, the same health request (`GET /`) and the same read-only plugin route (`GET /api/plugins/hermes-mobile/memory`). Median/P95 are computed by the benchmark script; RAM is Hermes Mobile process PSS.

| Metric | Before median | Before P95 | After median | After P95 |
|---|---:|---:|---:|---:|
| Dashboard health latency | 1559.05 ms | 1917.35 ms | 2116.36 ms | 3007.58 ms |
| Read-only plugin route latency | 1508.36 ms | 1853.42 ms | 2211.58 ms | 2484.45 ms |
| Hermes Mobile PSS | 78.08 MB | 84.41 MB | 79.99 MB | 80.05 MB |

Battery was sampled on every run: before 82% / 35.1 C / 4116 mV to 82% / 35.4 C / 4095 mV; after 81% / 36.3 C / 4115 mV to 80% / 36.0 C / 4118 mV. Battery is an observation, not a controlled power test.

Simple real chat latency and real tool execution latency are **not measured**. The Shizuku shell exposed HTTP but no websocket-capable client for the gateway RPC path, and the benchmark intentionally does not substitute health or plugin latency for those metrics.

Raw privacy-safe JSON: [`before`](benchmark-2026-11-07-before.json), [`after`](benchmark-2026-11-07-after.json). Re-run with `python3 tools/phone-benchmark.py --runs 10 --output report.json` while holding `tools/device-lock.sh`.
