#!/bin/bash
# Provision the UI/UX Pro Max skill bundle into the user-level skills directory
# (~/.claude/skills) so it is available in every folder, not just this repo.
#
# Runs on SessionStart. Idempotent: it only copies when the repo copy differs
# from what is already installed. Set UIPM_SKIP_GLOBAL_INSTALL=1 to opt out.
set -euo pipefail

if [ "${UIPM_SKIP_GLOBAL_INSTALL:-}" = "1" ]; then
  echo "ui-ux-pro-max: global install skipped (UIPM_SKIP_GLOBAL_INSTALL=1)"
  exit 0
fi

SKILL_NAMES=(ui-ux-pro-max design design-system ui-styling brand banner-design slides)

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SRC="$PROJECT_DIR/.claude/skills"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
STAMP="$DEST/.ui-ux-pro-max.stamp"

# xargs needs a real executable, so resolve the digest tool to a command, not a
# shell function (sha256sum on Linux, shasum -a 256 on macOS).
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD=(shasum -a 256)
else
  echo "ui-ux-pro-max: no sha256 tool available, skipping global install"
  exit 0
fi

# Content hash of the bundle: relative paths plus file contents, so it is stable
# across checkouts and independent of mtimes.
bundle_hash() {
  local root="$1" name
  for name in "${SKILL_NAMES[@]}"; do
    [ -d "$root/$name" ] || continue
    ( cd "$root/$name" && find . -type f -print0 | LC_ALL=C sort -z \
        | xargs -0 "${SHA_CMD[@]}" 2>/dev/null )
  done | "${SHA_CMD[@]}" | cut -d' ' -f1
}

# No repo copy to install from: fall back to the published CLI.
if [ ! -d "$SRC/ui-ux-pro-max" ]; then
  if command -v npx >/dev/null 2>&1; then
    echo "ui-ux-pro-max: no repo copy found, installing from npm..."
    npx --yes ui-ux-pro-max-cli@latest init --ai claude --global >/dev/null 2>&1 \
      && echo "ui-ux-pro-max: installed globally from npm" \
      || echo "ui-ux-pro-max: npm install failed (offline?), skill not installed globally"
  else
    echo "ui-ux-pro-max: no repo copy and no npx available, skipping"
  fi
  exit 0
fi

WANT="$(bundle_hash "$SRC")"

installed_complete=true
for name in "${SKILL_NAMES[@]}"; do
  [ -f "$DEST/$name/SKILL.md" ] || installed_complete=false
done

if [ "$installed_complete" = true ] && [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$WANT" ]; then
  echo "ui-ux-pro-max: already installed globally in $DEST (up to date)"
  exit 0
fi

mkdir -p "$DEST"
for name in "${SKILL_NAMES[@]}"; do
  [ -d "$SRC/$name" ] || continue
  rm -rf "$DEST/$name.tmp-uipm"
  cp -R "$SRC/$name" "$DEST/$name.tmp-uipm"
  rm -rf "$DEST/$name"
  mv "$DEST/$name.tmp-uipm" "$DEST/$name"
done

printf '%s\n' "$WANT" > "$STAMP"
echo "ui-ux-pro-max: installed ${#SKILL_NAMES[@]} skills globally into $DEST (available in every folder)"
