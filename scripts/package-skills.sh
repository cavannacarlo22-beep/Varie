#!/bin/bash
# Package each UI/UX Pro Max skill as a standalone .zip, ready to upload as an
# account-level skill (claude.ai -> Settings -> Capabilities -> Skills).
#
# Account-level skills sync down to every Claude Code session on every machine,
# which is the most durable way to have the skill available in any folder.
#
# Usage: ./scripts/package-skills.sh [output-dir]   (default: ./dist)
set -euo pipefail

SKILL_NAMES=(ui-ux-pro-max design design-system ui-styling brand banner-design slides)

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$REPO_ROOT/.claude/skills"
OUT="${1:-$REPO_ROOT/dist}"

if ! command -v zip >/dev/null 2>&1; then
  echo "error: 'zip' is required but not installed" >&2
  exit 1
fi

if [ ! -d "$SRC" ]; then
  echo "error: no skills found at $SRC" >&2
  exit 1
fi

# Symlinks make the Claude skill/plugin uploader reject the archive, so refuse
# to build one rather than shipping a zip that fails on import.
if [ -n "$(find "$SRC" -type l -print -quit)" ]; then
  echo "error: bundle contains symlinks, which the uploader rejects:" >&2
  find "$SRC" -type l >&2
  exit 1
fi

mkdir -p "$OUT"

for name in "${SKILL_NAMES[@]}"; do
  if [ ! -f "$SRC/$name/SKILL.md" ]; then
    echo "skip $name (no SKILL.md)"
    continue
  fi

  rm -f "$OUT/$name.zip"
  # Zip from inside .claude/skills so the archive root is the skill folder itself.
  ( cd "$SRC" && zip -qr -X "$OUT/$name.zip" "$name" \
      -x '*/__pycache__/*' '*.pyc' '*.DS_Store' )
  printf '  %-16s %s\n' "$name.zip" "$(du -h "$OUT/$name.zip" | cut -f1)"
done

echo
echo "Packaged into $OUT"
echo "Upload ui-ux-pro-max.zip at claude.ai -> Settings -> Capabilities -> Skills"
