#!/data/data/com.termux/files/usr/bin/python3
"""Local bounded-memory attachment receiver for Hermes Taher (Termux only)."""
import base64
import json
import os
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import re
import shutil
import threading

ROOT = Path("/sdcard/HermesUploads")
TEMP = Path.home() / ".hermes-mobile" / "upload-parts"
LOCK = threading.Lock()
IDENT = re.compile(r"hm[a-z0-9]{8,64}\Z")
CHUNK = 256 * 1024

class Handler(BaseHTTPRequestHandler):
    def respond(self, status, data):
        body = data.encode() if isinstance(data, str) else json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json" if isinstance(data, dict) else "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        ident = self.headers.get("X-Upload-Id", "")
        if not IDENT.fullmatch(ident):
            return self.respond(400, "invalid upload id")
        try:
            length = int(self.headers.get("Content-Length", "-1"))
            offset = int(self.headers.get("X-Offset", "-1"))
        except ValueError:
            return self.respond(400, "invalid offset or length")
        if length < 0 or length > CHUNK or offset < 0:
            return self.respond(413, "invalid chunk size")
        TEMP.mkdir(parents=True, exist_ok=True)
        target = TEMP / (ident + ".part")
        with LOCK:
            if self.path == "/chunk":
                actual = target.stat().st_size if target.exists() else 0
                if offset != actual:
                    return self.respond(409, "offset mismatch")
                data = self.rfile.read(length)
                if len(data) != length:
                    return self.respond(400, "incomplete chunk")
                with target.open("ab") as out:
                    out.write(data)
                return self.respond(200, "ok")
            if self.path != "/finish":
                return self.respond(404, "not found")
            try:
                size = int(self.headers.get("X-File-Size", "-1"))
                raw = self.headers.get("X-File-Name", "")
                name = base64.urlsafe_b64decode(raw + "=" * (-len(raw) % 4)).decode("utf-8")
                name = Path(name.replace("\\", "/")).name
                if not name or name in (".", "..") or size < 0:
                    raise ValueError("bad name or size")
            except (ValueError, UnicodeError):
                return self.respond(400, {"error": "invalid filename"})
            if not target.exists() and size == 0:
                target.touch()
            if not target.exists() or target.stat().st_size != size:
                return self.respond(409, {"error": "incomplete upload"})
            try:
                ROOT.mkdir(parents=True, exist_ok=True)
                safe = re.sub(r"[^\w.() -]", "_", name)[:120] or "file"
                dest = ROOT / (ident + "-" + safe)
                # Termux private storage and /sdcard are different filesystems (EXDEV).
                staging = ROOT / (ident + '.copying')
                with target.open('rb') as source, staging.open('wb') as output:
                    shutil.copyfileobj(source, output, 256 * 1024)
                os.replace(staging, dest)
                target.unlink()
                return self.respond(200, {"path": str(dest)})
            except OSError as exc:
                return self.respond(500, {"error": str(exc)})

    def log_message(self, *_):
        pass

if __name__ == "__main__":
    ThreadingHTTPServer(("127.0.0.1", 9127), Handler).serve_forever()
