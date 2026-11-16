#!/usr/bin/env bash
# Copy layouts/*.json and mods/*/ into the herdr-app home
set -euo pipefail
shopt -s nullglob

SRC_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

mkdir -p "$HOME_DIR/layouts" "$HOME_DIR/mods"

for src in "$SRC_DIR"/layouts/*.json; do
  dest="$HOME_DIR/layouts/$(basename "$src")"
  # rsync renames a temp file into place, so a symlink at dest becomes a regular file
  rsync -a "$src" "$dest"
  echo "layout: $dest"
done

for src in "$SRC_DIR"/mods/*/; do
  dest="$HOME_DIR/mods/$(basename "$src")"
  # remove a symlink, since rsync would write through it to the link target (migration from the old symlink setup)
  if [ -L "$dest" ]; then rm "$dest"; fi
  # --delete only applies inside this mod folder. Exclude the type files the app writes so they are kept (don't use --delete-excluded)
  rsync -a --delete --exclude=jsconfig.json --exclude='*.d.ts' "$src" "$dest/"
  echo "mod:    $dest"
done
