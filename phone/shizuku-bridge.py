#!/usr/bin/env python3
"""Local Unix-socket bridge: execute Shizuku rish only from Termux host.
The socket lives in Termux private home; never listens on a TCP port.
"""
import base64, json, os, socket, subprocess, sys
from pathlib import Path

HOME = Path(os.environ["HOME"])
SOCKET = HOME / ".hermes-mobile" / "shizuku.sock"
RISH = HOME / "bin" / "rish"
MAX_REQUEST = 65536

def main():
    SOCKET.parent.mkdir(parents=True, exist_ok=True)
    if SOCKET.exists():
        probe = socket.socket(socket.AF_UNIX)
        try:
            probe.settimeout(1)
            probe.connect(str(SOCKET))
            print("bridge already running", flush=True)
            return
        except OSError:
            SOCKET.unlink()
        finally:
            probe.close()
    srv = socket.socket(socket.AF_UNIX)
    srv.bind(str(SOCKET))
    os.chmod(SOCKET, 0o600)
    srv.listen(4)
    print("Shizuku bridge ready", flush=True)
    while True:
        conn, _ = srv.accept()
        with conn:
            conn.settimeout(65)
            try:
                payload = b""
                while b"\n" not in payload:
                    part = conn.recv(4096)
                    if not part or len(payload) + len(part) > MAX_REQUEST:
                        raise ValueError("invalid request size")
                    payload += part
                req = json.loads(payload.split(b"\n", 1)[0])
                command = req.get("command")
                if not isinstance(command, str) or not command or len(command) > 32768:
                    raise ValueError("command must be non-empty text")
                timeout = min(max(int(req.get("timeout", 45)), 1), 60)
                stdin_data = req.get("stdin_b64", "")
                if not isinstance(stdin_data, str) or len(stdin_data) > 131072:
                    raise ValueError("invalid stdin")
                input_data = base64.b64decode(stdin_data, validate=True) if stdin_data else None
                result = subprocess.run([str(RISH), "-c", command], input=input_data,
                                        capture_output=True, timeout=timeout)
                response = {"code": result.returncode,
                            "stdout": result.stdout[:1048576].decode("utf-8", "replace"),
                            "stderr": result.stderr[:1048576].decode("utf-8", "replace")}
            except subprocess.TimeoutExpired:
                response = {"code": 124, "stdout": "", "stderr": "Shizuku request timed out"}
            except Exception as exc:
                response = {"code": 1, "stdout": "", "stderr": str(exc)}
            try:
                conn.sendall((json.dumps(response) + "\n").encode())
            except OSError:
                pass

if __name__ == "__main__":
    main()
