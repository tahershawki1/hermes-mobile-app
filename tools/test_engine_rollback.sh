#!/usr/bin/env bash
# Regression test for phone/engine-update.sh: healthy promotion and failed-start rollback.
set -euo pipefail
here=$(cd "$(dirname "$0")/.." && pwd)
t=$(mktemp -d); trap 'kill "$server" 2>/dev/null || true; rm -rf "$t"' EXIT
mkdir -p "$t/root/active" "$t/candidate-good" "$t/candidate-bad"
printf old > "$t/root/active/version"
printf good > "$t/candidate-good/version"
printf bad > "$t/candidate-bad/version"
cat > "$t/health.py" <<'PY'
import http.server, pathlib
mode = pathlib.Path(__import__('os').environ['MODE'])
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        ok = mode.read_text().strip() == 'good'
        self.send_response(200 if ok else 503)
        self.end_headers(); self.wfile.write((('{"ok":true}' if ok else '{"ok":false}')+'\n').encode())
    def log_message(self, *_): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 0), H)
PY
# Replace the server's ephemeral-port setup with a small deterministic server.
cat > "$t/server.py" <<'PY'
import http.server, os, pathlib
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        ok = pathlib.Path(os.environ['MODE']).read_text().strip() == 'good'
        self.send_response(200 if ok else 503); self.end_headers()
        self.wfile.write((('{"ok":true}' if ok else '{"ok":false}')+'\n').encode())
    def log_message(self, *_): pass
http.server.ThreadingHTTPServer(('127.0.0.1', 19119), H).serve_forever()
PY
printf good > "$t/mode"
cat > "$t/restart.sh" <<EOF
#!/usr/bin/env bash
[ "\$(cat '$t/root/active/version')" = good ]
EOF
chmod +x "$t/restart.sh"
MODE="$t/mode" python3 "$t/server.py" & server=$!
for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fsS http://127.0.0.1:19119/ >/dev/null 2>&1 && break; sleep 0.1; done
curl -fsS http://127.0.0.1:19119/ >/dev/null
bash "$here/phone/engine-update.sh" "$t/root" "$t/candidate-good" http://127.0.0.1:19119/ --restart "$t/restart.sh"
test "$(cat "$t/root/active/version")" = good
[ ! -e "$t/root/.rollback" ]
printf bad > "$t/mode"
printf old2 > "$t/root/active/version"
mkdir "$t/candidate-bad2"; printf bad > "$t/candidate-bad2/version"
if bash "$here/phone/engine-update.sh" "$t/root" "$t/candidate-bad2" http://127.0.0.1:19119/; then
  echo 'FAIL: unhealthy candidate was accepted' >&2; exit 1
fi
test "$(cat "$t/root/active/version")" = old2
[ ! -e "$t/root/.rollback" ]
echo 'engine rollback: OK (healthy promotion and failed-health restoration)'
