#!/bin/bash
# Provision every skill bundled in this repo into the user-level skills
# directory (~/.claude/skills) so they are available in every folder, not just
# this repo.
#
# Runs on SessionStart. Idempotent: it only copies when the repo copy differs
# from what is already installed. Set SKILLS_SKIP_GLOBAL_INSTALL=1 (or the
# legacy UIPM_SKIP_GLOBAL_INSTALL=1) to opt out.
set -euo pipefail

if [ "${SKILLS_SKIP_GLOBAL_INSTALL:-${UIPM_SKIP_GLOBAL_INSTALL:-}}" = "1" ]; then
  echo "skills: global install skipped (SKILLS_SKIP_GLOBAL_INSTALL=1)"
  exit 0
fi

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
SRC="$PROJECT_DIR/.claude/skills"
DEST="${CLAUDE_CONFIG_DIR:-$HOME/.claude}/skills"
STAMP="$DEST/.repo-skills.stamp"

# Every directory in the repo bundle that actually is a skill.
SKILL_NAMES=()
if [ -d "$SRC" ]; then
  for path in "$SRC"/*/; do
    [ -f "$path/SKILL.md" ] || continue
    SKILL_NAMES+=("$(basename "$path")")
  done
fi

# xargs needs a real executable, so resolve the digest tool to a command, not a
# shell function (sha256sum on Linux, shasum -a 256 on macOS).
if command -v sha256sum >/dev/null 2>&1; then
  SHA_CMD=(sha256sum)
elif command -v shasum >/dev/null 2>&1; then
  SHA_CMD=(shasum -a 256)
else
  echo "skills: no sha256 tool available, skipping global install"
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

# No repo copy to install from: fall back to the published ui-ux-pro-max CLI,
# which is the one bundle available from a package registry.
if [ ${#SKILL_NAMES[@]} -eq 0 ]; then
  if command -v npx >/dev/null 2>&1; then
    echo "skills: no repo copy found, installing ui-ux-pro-max from npm..."
    npx --yes ui-ux-pro-max-cli@latest init --ai claude --global >/dev/null 2>&1 \
      && echo "skills: installed ui-ux-pro-max globally from npm" \
      || echo "skills: npm install failed (offline?), no skills installed globally"
  else
    echo "skills: no repo copy and no npx available, skipping"
  fi
  exit 0
fi

WANT="$(bundle_hash "$SRC")"

installed_complete=true
for name in "${SKILL_NAMES[@]}"; do
  [ -f "$DEST/$name/SKILL.md" ] || installed_complete=false
done

if [ "$installed_complete" = true ] && [ -f "$STAMP" ] && [ "$(cat "$STAMP")" = "$WANT" ]; then
  echo "skills: ${#SKILL_NAMES[@]} skills already installed globally in $DEST (up to date)"
  exit 0
fi

mkdir -p "$DEST"
for name in "${SKILL_NAMES[@]}"; do
  [ -d "$SRC/$name" ] || continue
  rm -rf "$DEST/$name.tmp-install"
  cp -R "$SRC/$name" "$DEST/$name.tmp-install"
  rm -rf "$DEST/$name"
  mv "$DEST/$name.tmp-install" "$DEST/$name"
done

printf '%s\n' "$WANT" > "$STAMP"
echo "skills: installed ${#SKILL_NAMES[@]} skills globally into $DEST (available in every folder)"
