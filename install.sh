#!/usr/bin/env bash
# layouts/*.json と mods/*/ を herdr-app のホームへコピーする
set -euo pipefail
shopt -s nullglob

SRC_DIR="$(cd -- "$(dirname "${BASH_SOURCE[0]}")" >/dev/null && pwd)"
HOME_DIR="${HERDR_APP_HOME:-$HOME/.config/herdr-app}"

mkdir -p "$HOME_DIR/layouts" "$HOME_DIR/mods"

for src in "$SRC_DIR"/layouts/*.json; do
  dest="$HOME_DIR/layouts/$(basename "$src")"
  # rsync は一時ファイルを rename するので、dest が symlink でも実ファイルに置き換わる
  rsync -a "$src" "$dest"
  echo "layout: $dest"
done

for src in "$SRC_DIR"/mods/*/; do
  dest="$HOME_DIR/mods/$(basename "$src")"
  # symlink のままだと rsync がリンク先に書き込むので外す（旧 symlink 運用からの移行用）
  if [ -L "$dest" ]; then rm "$dest"; fi
  # --delete はこの mod フォルダ内のみ。app が書く型ファイルは除外し、消さない (--delete-excluded は使わない)
  rsync -a --delete --exclude=jsconfig.json --exclude='*.d.ts' "$src" "$dest/"
  echo "mod:    $dest"
done
