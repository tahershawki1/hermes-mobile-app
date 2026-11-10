#!/usr/bin/env bash
# Transactionally promote a staged Hermes engine and roll it back if startup health fails.
# Usage: engine-update.sh ACTIVE_PARENT CANDIDATE HEALTH_URL [--restart RESTART_COMMAND]
set -euo pipefail

[ "$#" -ge 3 ] || { echo "usage: $0 ACTIVE_PARENT CANDIDATE HEALTH_URL [--restart COMMAND]" >&2; exit 2; }
root=$1
candidate=$2
health=$3
restart=""
if [ "${4:-}" = "--restart" ] && [ -n "${5:-}" ]; then restart=$5
elif [ "$#" -gt 3 ]; then echo "invalid restart arguments" >&2; exit 2; fi
active="$root/active"
backup="$root/.rollback"
failed="$root/.failed"
[ -d "$candidate" ] || { echo "candidate is not a directory: $candidate" >&2; exit 1; }
[ ! -e "$backup" ] || { echo "rollback slot is occupied: $backup" >&2; exit 1; }

restore() {
  rm -rf "$failed"
  [ ! -e "$active" ] || mv "$active" "$failed"
  mv "$backup" "$active"
  rm -rf "$failed"
  [ -z "$restart" ] || "$restart"
}

[ -e "$active" ] || { echo "active engine is missing: $active" >&2; exit 1; }
mv "$active" "$backup"
mv "$candidate" "$active"
moved=true
if [ -n "$restart" ] && ! "$restart"; then
  moved=false
fi
if [ "$moved" = true ] && curl -fsS --max-time 15 "$health" | grep -Eq '"ok"[[:space:]]*:[[:space:]]*true'; then
  rm -rf "$backup"
  echo "engine update healthy"
else
  echo "engine health check failed; restoring previous engine" >&2
  restore
  exit 1
fi
