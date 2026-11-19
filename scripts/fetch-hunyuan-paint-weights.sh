#!/usr/bin/env bash
# Fetch the paint-stage weights with plain HTTP.
#
# WHY NOT `huggingface_hub`
# -------------------------
# The xet transfer backend stalls on the two big files: the download sits at
# zero bytes and never moves, with no error. The CDN itself is fine. So the
# files are fetched with `curl --continue-at`, which resumes, retries, and
# reports honestly.
#
#   bash scripts/fetch-hunyuan-paint-weights.sh [repo]
#
set -uo pipefail

REPO="${1:-$HOME/.cache/assetfurnace/repo}"
BASE="https://huggingface.co/zimengxiong/hunyuan3d-mlx-paint-large/resolve/main"
DEST="$REPO/hunyuan_mlx/paint/weights/hunyuan3d-paintpbr-v2-1"

FILES=(
  "dinov2/model.safetensors"
  "unet/diffusion_pytorch_model.safetensors"
  "vae/diffusion_pytorch_model.safetensors"
  "realesrgan/rrdbnet_mlx.safetensors"
  "unet/config.json"
  "vae/config.json"
  "dinov2/config.json"
  "dinov2/preprocessor_config.json"
  "scheduler/scheduler_config.json"
)

mkdir -p "$DEST"

fetch() {
  local path="$1"
  local out="$DEST/$path"
  mkdir -p "$(dirname "$out")"
  if [ -s "$out" ]; then
    echo "have  $path"
    return 0
  fi
  echo "fetch $path"
  curl -L --fail --continue-at - --retry 8 --retry-delay 5 \
       --retry-all-errors --connect-timeout 30 --max-time 3600 \
       -o "$out" "$BASE/$path" \
    || { echo "FAILED $path"; return 1; }
  echo "done  $path ($(du -h "$out" | cut -f1))"
}

# Four at a time: enough to saturate the link, not enough to fight over it.
PIDS=()
for f in "${FILES[@]}"; do
  fetch "$f" &
  PIDS+=($!)
  if [ ${#PIDS[@]} -ge 4 ]; then
    wait "${PIDS[0]}"
    PIDS=("${PIDS[@]:1}")
  fi
done
wait

echo
echo "paint weights:"
du -sh "$DEST"
find "$DEST" -name "*.safetensors" -exec ls -la {} \; | awk '{print $5, $9}'
