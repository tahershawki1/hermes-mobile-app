#!/usr/bin/env python3
"""Privacy-safe Hermes Mobile benchmark over Shizuku.

Runs on the workstation and uses `rish -c` for every phone operation. It never
collects chat text, tokens, URLs, or raw command output. Chat/tool RPC timings
are intentionally reported as unavailable unless a websocket-capable runner is
provided; do not substitute HTTP health for those metrics.
"""
from __future__ import annotations
import argparse, json, math, re, statistics, subprocess, time
from datetime import datetime, timezone

PKG = "com.tahershawki.hermesmobile"

def rish(command: str) -> str:
    return subprocess.check_output(["rish", "-c", command], text=True, stderr=subprocess.STDOUT)

def percentile(values, p):
    if not values: return None
    xs = sorted(values); k = (len(xs)-1) * p / 100
    lo, hi = math.floor(k), math.ceil(k)
    return xs[lo] if lo == hi else xs[lo] + (xs[hi]-xs[lo]) * (k-lo)

def summary(values):
    return {"runs": len(values), "median_ms": round(statistics.median(values), 2), "p95_ms": round(percentile(values, 95), 2), "min_ms": round(min(values), 2), "max_ms": round(max(values), 2)}

def http_health():
    t = time.perf_counter(); rish("curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:9119/"); return (time.perf_counter()-t)*1000

def plugin_memory():
    t = time.perf_counter(); rish("curl -fsS --max-time 10 -o /dev/null http://127.0.0.1:9119/api/plugins/hermes-mobile/memory"); return (time.perf_counter()-t)*1000

def ram_mb():
    out = rish(f"dumpsys meminfo {PKG}")
    m = re.search(r"TOTAL\s+(\d+)", out)
    return int(m.group(1))/1024 if m else None

def battery():
    out = rish("dumpsys battery")
    def n(name):
        m = re.search(rf"^\s*{name}:\s*(-?\d+)", out, re.M); return int(m.group(1)) if m else None
    return {"level_percent": n("level"), "temperature_c": (n("temperature")/10 if n("temperature") is not None else None), "voltage_mv": n("voltage")}

def run(args):
    health=[]; plugin=[]; ram=[]; bats=[]
    for _ in range(args.runs):
        health.append(http_health()); plugin.append(plugin_memory())
        v=ram_mb()
        if v is not None: ram.append(v)
        bats.append(battery()); time.sleep(args.pause)
    return {"schema":"hermes-mobile-phone-benchmark-v1", "generated_at":datetime.now(timezone.utc).isoformat(), "runs_requested":args.runs, "device_access":"Shizuku rish", "privacy":"No chat text, tokens, identifiers, paths, screenshots, or raw command output collected.", "health_latency":summary(health), "plugin_route_latency":summary(plugin), "chat_latency":{"status":"not_measured","reason":"The connected shell exposes HTTP but no websocket-capable client; HTTP health must not be presented as chat latency."}, "tool_execution_latency":{"status":"not_measured","reason":"A real tool turn requires the same websocket RPC path; no substitute endpoint was used."}, "ram_pss_mb":{"runs":len(ram),"median_mb":round(statistics.median(ram),2) if ram else None,"p95_mb":round(percentile(ram,95),2) if ram else None,"samples_mb":[round(x,2) for x in ram]}, "battery":{"samples":bats,"start":bats[0] if bats else None,"end":bats[-1] if bats else None}}

if __name__ == "__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--runs",type=int,default=10); ap.add_argument("--pause",type=float,default=.5); ap.add_argument("--output"); a=ap.parse_args()
    if a.runs < 3: ap.error("--runs must be at least 3")
    result=run(a); text=json.dumps(result,indent=2)+"\n"
    if a.output: open(a.output,"w",encoding="utf-8").write(text)
    print(text,end="")
