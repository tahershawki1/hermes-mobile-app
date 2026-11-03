#!/data/data/com.termux/files/usr/bin/bash
# Read-only performance diagnostic for Hermes Taher. Run from Termux.
set -u
export LC_ALL=C
DEB="$HOME/bin/hermes-debian"
LOG="$HOME/hermes-performance-$(date +%Y%m%d-%H%M%S).txt"
exec > >(tee "$LOG") 2>&1
echo "Hermes Taher latency baseline | $(date -u +%FT%TZ)"
echo "Device: $(uname -m) | Android $(getprop ro.build.version.release)"
echo "Distro: $("$DEB" --which 2>/dev/null || echo unavailable)"
echo "--- Host load ---"
uptime
free -m
echo "--- Active processes (filtered; no command-line arguments) ---"
ps -A -o PID,PPID,%CPU,RSS,NAME 2>/dev/null | grep -E '(^ *PID|python|proot|node|llama|termux|hermes)' | head -60 || true
echo "--- Loopback service latency (seconds) ---"
for port in 9119 11434; do
  for n in 1 2 3 4 5; do
    curl --silent --output /dev/null --max-time 4 --write-out "port=$port sample=$n http=%{http_code} total=%{time_total} connect=%{time_connect}\n" "http://127.0.0.1:$port/" || true
  done
done
echo "--- Direct Termux command latency (ms) ---"
python3 - <<'PY'
import subprocess,time,statistics
for cmd in (['true'],['pwd'],['ls','-d','.']):
    samples=[]
    for _ in range(5):
        start=time.perf_counter()
        subprocess.run(cmd,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15)
        samples.append((time.perf_counter()-start)*1000)
    print('cmd=',cmd,'samples_ms=',[round(x,1) for x in samples],'avg_ms=',round(statistics.mean(samples),1))
PY
echo "--- Debian cold and warm command latency (ms) ---"
if [ -x "$DEB" ]; then
  python3 - "$DEB" <<'PY'
import subprocess,time,statistics,sys
deb=sys.argv[1]
for cmd in ('true','pwd','ls -d .'):
    samples=[]
    for _ in range(5):
        start=time.perf_counter()
        try:
            result=subprocess.run([deb,'sh','-c',cmd],stdout=subprocess.DEVNULL,stderr=subprocess.PIPE,timeout=35)
            samples.append((time.perf_counter()-start)*1000)
            if result.returncode: print('warning:',cmd,'exit=',result.returncode)
        except subprocess.TimeoutExpired:
            print('timeout:',cmd);break
    if samples: print('cmd=',cmd,'samples_ms=',[round(x,1) for x in samples],'avg_ms=',round(statistics.mean(samples),1))
PY
fi
echo "--- Service log tails (avoid sharing raw logs if they contain secrets) ---"
for name in dashboard cron-ticker app-keeper; do
  f="$HOME/logs/$name.log"
  if [ -f "$f" ]; then
    echo "$name log exists, bytes=$(wc -c < "$f")"
    grep -Eic 'error|timeout|exception|restart|failed' "$f" 2>/dev/null || true
  fi
done
echo "Report saved to $LOG"
