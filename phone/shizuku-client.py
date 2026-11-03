#!/usr/bin/env python3
"""Debian-side rish shim. Usage: rish -c 'id'."""
import json, os, socket, sys
SOCKET = "/data/data/com.termux/files/home/.hermes-mobile/shizuku.sock"

def main():
    args = sys.argv[1:]
    if len(args) != 2 or args[0] != "-c":
        print("Usage: rish -c 'Android shell command'", file=sys.stderr)
        return 2
    try:
        with socket.socket(socket.AF_UNIX) as conn:
            conn.settimeout(67)
            conn.connect(SOCKET)
            conn.sendall((json.dumps({"command": args[1]}) + "\n").encode())
            data = bytearray()
            while True:
                chunk = conn.recv(8192)
                if not chunk: break
                data.extend(chunk)
                if len(data) > 2200000: raise ValueError("response too large")
        result = json.loads(data)
        sys.stdout.write(result.get("stdout", ""))
        sys.stderr.write(result.get("stderr", ""))
        return int(result.get("code", 1))
    except (OSError, ValueError) as exc:
        print(f"Shizuku bridge unavailable: {exc}", file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
