#!/data/data/com.termux/files/usr/bin/bash
# Install only the chunk receiver for Hermes Taher. Does not modify Hermes itself.
set -euo pipefail
url="https://raw.githubusercontent.com/tahershawki1/hermes-mobile-app/development/phone/chunk-upload.py"
command -v python3 >/dev/null || pkg install -y python
mkdir -p "$HOME/bin" "$HOME/logs"
curl -fsSL "$url" -o "$HOME/bin/hermes-chunk-upload.py"
python3 -m py_compile "$HOME/bin/hermes-chunk-upload.py"
if ! (exec 3<>/dev/tcp/127.0.0.1/9127) 2>/dev/null; then
  nohup python3 "$HOME/bin/hermes-chunk-upload.py" </dev/null >>"$HOME/logs/chunk-upload.log" 2>&1 &
fi
echo "Hermes Taher chunk receiver installed on localhost:9127"
