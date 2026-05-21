#!/bin/bash
# AIOX Update Bypass Wrapper (Orion-orchestrated)
# Skips porcelain check (lines 23-30 of update-aiox.sh) because .aiox-core/ is untracked in this project.
# Concatenates lines 1-22 (preflight) + lines 31+ (sync logic).
#
# Usage: wsl bash -c "cd '/mnt/c/.../Site IA performance' && bash .aiox-core-update-bypass.sh"

set -e

ORIG=".aiox-core/scripts/update-aiox.sh"
TMP_SCRIPT=$(mktemp)
trap 'rm -f "$TMP_SCRIPT"' EXIT

if [ ! -f "$ORIG" ]; then
  echo "❌ Original script not found at $ORIG"
  exit 1
fi

# Lines 1-22 (header + preflight rsync check) + lines 31+ (sync logic)
sed -n '1,22p' "$ORIG" > "$TMP_SCRIPT"
sed -n '31,$p' "$ORIG" >> "$TMP_SCRIPT"

chmod +x "$TMP_SCRIPT"
bash "$TMP_SCRIPT"
