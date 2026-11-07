import importlib.util
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("latency", ROOT / "tools" / "hermes_latency_summary.py")
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

def test_aggregates_without_leaking_prompt(tmp_path):
    log = tmp_path / "agent.log"
    log.write_text(
        "secret=PRIVATE123 HTTP 429 duration=500ms prompt_tokens=13325 tool_call\n"
        "HTTP 402 elapsed=12.1s input_tokens=42045 model_request\n"
        "user message PRIVATE456\n",
        encoding="utf-8",
    )
    report = mod.summarize(log)
    assert report["counts"]["http_429"] == 1
    assert report["counts"]["http_402"] == 1
    assert report["observed_durations_seconds"]["max"] == 12.1
    assert report["observed_input_tokens"]["max"] == 42045
    assert "PRIVATE123" not in str(report)
    assert "PRIVATE456" not in str(report)

def test_empty_log(tmp_path):
    log = tmp_path / "empty.log"
    log.write_text("", encoding="utf-8")
    assert mod.summarize(log)["observed_durations_seconds"]["median"] is None
