#!/usr/bin/env python3
"""Offline Hermes latency summary. Reads log files, prints only aggregate metrics.

Usage: python3 tools/hermes_latency_summary.py /path/to/agent.log
No network calls, no model calls, no writes. Never prints log lines or prompt text.
"""
import argparse
import json
import re
from collections import Counter
from pathlib import Path

DURATION = re.compile(r"(?i)(?:duration|elapsed|latency|took|time)[^\n]{0,35}?(\d+(?:\.\d+)?)\s*(ms|milliseconds?|s|sec(?:onds)?)\b")
TOKENS = re.compile(r"(?i)(?:prompt_tokens|input_tokens|input tokens)\s*[:=]\s*(\d+)")
ERRORS = re.compile(r"(?i)(?:HTTP\s*|status\s*[:=]\s*)(402|429)\b")
EVENTS = re.compile(r"(?i)(?:tool[_ -]?call|tool[_ -]?result|api[_ -]?call|model[_ -]?request|compression|stream drop)")
MAX_LINES = 1_000_000
MAX_LINE_CHARS = 4096

def summarize(path: Path) -> dict:
    counts = Counter()
    durations = []
    input_tokens = []
    with path.open("r", encoding="utf-8", errors="replace") as f:
        for n, line in enumerate(f):
            if n >= MAX_LINES:
                counts["truncated"] = 1
                break
            counts["lines"] += 1
            line = line[:MAX_LINE_CHARS]
            for match in ERRORS.finditer(line):
                counts["http_" + match.group(1)] += 1
            for match in EVENTS.finditer(line):
                event = match.group(0).lower().replace("-", "_").replace(" ", "_")
                counts[event] += 1
            for match in DURATION.finditer(line):
                value = float(match.group(1))
                unit = match.group(2).lower()
                seconds = value / 1000 if unit.startswith("m") else value
                if seconds <= 86400:
                    durations.append(seconds)
            for match in TOKENS.finditer(line):
                input_tokens.append(int(match.group(1)))
    durations.sort()
    return {
        "source": "local_log_aggregate",
        "counts": dict(sorted(counts.items())),
        "observed_durations_seconds": {
            "count": len(durations),
            "median": round(durations[len(durations)//2], 3) if durations else None,
            "max": round(durations[-1], 3) if durations else None,
        },
        "observed_input_tokens": {
            "count": len(input_tokens),
            "min": min(input_tokens) if input_tokens else None,
            "max": max(input_tokens) if input_tokens else None,
        },
        "caution": "Regex observations only; mixed event durations are not end-to-end turn latency. Use turn IDs and monotonic instrumentation for accurate comparisons.",
    }

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("log", type=Path)
    args = parser.parse_args()
    if not args.log.is_file():
        parser.error("Log file does not exist")
    print(json.dumps(summarize(args.log), indent=2))

if __name__ == "__main__":
    main()
