#!/bin/sh
set -eu

project_dir=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
stage_dir=$(mktemp -d)
trap 'rm -rf "$stage_dir"' EXIT HUP INT TERM

mkdir -p "$stage_dir/public/css" "$stage_dir/functions"
for asset in index.html script.js transmission.html beacon-signal.wav; do
    cp "$project_dir/$asset" "$stage_dir/public/"
done
cp "$project_dir/css/style.css" "$stage_dir/public/css/"

# This project serves only the frontend; verification stays on its own project.
cat > "$stage_dir/netlify.toml" <<'CONFIG'
[build]
  publish = "public"
[functions]
  directory = "functions"
CONFIG

cd "$stage_dir"
netlify deploy --site rainbow-caramel-bcc9e2 --prod --no-build --message 'Publish Pixel recovery console'
