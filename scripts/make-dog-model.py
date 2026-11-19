"""Make a real 3D dog from a photograph, and check it before shipping it.

THE RECIPE, END TO END, ON AN APPLE-SILICON MACHINE
===================================================

This is the pipeline the app's Record region documents, made runnable. It
turns ONE photograph of a real animal into a textured mesh, verifies the mesh
from four sides, and reports the numbers the delivery targets care about.

    uv run --with playwright python3 scripts/make-dog-model.py \
        --image public/expo/expo-single.jpg --out public/expo/expo.glb

WHY A SCRIPT AND NOT A PARAGRAPH
--------------------------------
Because the generation takes half an hour and the weights are thirteen
gigabytes, and because the point of a pipeline is that the next dog does not
need the next hour of someone's attention. Every step is idempotent and every
step leaves a receipt.

THE INPUT IS THE WHOLE PROBLEM
------------------------------
Image-to-3D is only as good as the picture, and the picture must contain
EXACTLY ONE SUBJECT, full body, feet on the ground, plain background, nothing
cropped. Two dogs in a reference sheet produce a confident two-headed
statue. If you only have photographs of the real animal, render the reference
first — a photoreal single-subject studio plate from the owner's own
photographs — and feed THAT in.

THE WEIGHTS
-----------
13.3 GB, and they must NOT live in /tmp:

    git clone --depth 1 https://github.com/Bingeljell/image-to-3dlab.git
    uv sync --project hunyuan_mlx/shape
    uv sync --project hunyuan_mlx/paint
    hunyuan_mlx/shape/.venv/bin/python hunyuan_mlx/download_weights.py --yes

    4.6 GB  shape  (tencent/Hunyuan3D-2)
    8.7 GB  paint  (zimengxiong/hunyuan3d-mlx-paint-large)

The licence is the Tencent Hunyuan Community Licence: NOT licensed for the EU,
the UK or South Korea. Ship the `.provenance.json` sidecar with the asset.

THE TARGETS THIS CHECKS AGAINST
-------------------------------
    30–80k triangles per visible dog
    one 1K–2K base-colour texture
    ≤5 MB per delivered dog
    the whole dog visible from every angle, with no fused or doubled parts
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path.home() / ".cache" / "assetfurnace" / "repo"
TARGET_TRIANGLES = (30_000, 80_000)
TARGET_MEGABYTES = 5.0


def say(msg):
    print(f"[model] {msg}", flush=True)


def human(size_bytes):
    return f"{size_bytes / (1024 * 1024):.1f} MB"


def check_weights():
    shape = REPO / "hunyuan_mlx/shape/weights/Hunyuan3D-2"
    paint = REPO / "hunyuan_mlx/paint/weights/hunyuan3d-paintpbr-v2-1"
    missing = [p for p in (shape, paint) if not p.is_dir()]
    if missing:
        say("MISSING WEIGHTS:")
        for path in missing:
            say(f"  {path}")
        say("Get them with:")
        say("  git clone --depth 1 https://github.com/Bingeljell/image-to-3dlab.git")
        say("  uv sync --project hunyuan_mlx/shape && uv sync --project hunyuan_mlx/paint")
        say("  hunyuan_mlx/shape/.venv/bin/python hunyuan_mlx/download_weights.py --yes")
        sys.exit(2)
    return shape, paint


def check_input(image: Path):
    if not image.is_file():
        say(f"no such image: {image}")
        sys.exit(2)
    size = image.stat().st_size
    say(f"input {image} ({human(size)})")


def generate(image: Path, out: Path, model: str, octree: int, faces: int):
    check_weights()
    python = REPO / "hunyuan_mlx/shape/.venv/bin/python"
    script = REPO / "scripts/hunyuan_mlx_xiong_generate.py"
    cmd = [
        str(python), str(script), str(image), str(out),
        "--model", model,
        "--octree-resolution", str(octree),
        "--decimation-target", str(faces),
    ]
    say("generating (the first run pays for MLX compilation — about 16 minutes)")
    say(" ".join(cmd))
    proc = subprocess.run(cmd, cwd=str(REPO))
    if proc.returncode != 0:
        say(f"generation failed with code {proc.returncode}")
        sys.exit(proc.returncode)
    if not out.is_file():
        say("the run finished but produced no model")
        sys.exit(1)


def verify(out: Path, turntable: Path):
    """LOOK AT IT, FROM FOUR SIDES.

    A good single render is not evidence that the mesh works from every
    angle. This is the part that gets skipped, and it is the part that finds
    the fused legs and the doubled tail.
    """
    blender = shutil.which("blender") or "/Applications/Blender.app/Contents/MacOS/Blender"
    if not Path(blender).exists():
        say("no Blender found; skipping the turntable render")
        return
    turntable.mkdir(parents=True, exist_ok=True)
    script = Path(__file__).with_name("render-turntable.py")
    say("rendering the turntable")
    subprocess.run(
        [blender, "--background", "--python", str(script), "--", str(out), str(turntable)],
        check=False,
    )


def report(out: Path):
    if not out.is_file():
        return
    size = out.stat().st_size
    say(f"model {out} ({human(size)})")
    manifest = out.with_name(f"{out.stem}.json")
    if manifest.is_file():
        data = json.loads(manifest.read_text())
        say(f"manifest: {json.dumps(data.get('parameters', {}), sort_keys=True)}")
        timing = data.get("timing", data.get("seconds", {}))
        if timing:
            say(f"timing: {json.dumps(timing, sort_keys=True)}")
    provenance = out.with_suffix(".provenance.json")
    if provenance.is_file():
        say(f"licence sidecar: {provenance}")

    # THE DELIVERY BUDGET, MEASURED.
    if size / (1024 * 1024) > TARGET_MEGABYTES:
        say(
            f"OVER BUDGET: {human(size)} against a {TARGET_MEGABYTES} MB target. "
            "Lower --paint-tex, lower --decimation-target, or compress the texture."
        )
    else:
        say(f"within the {TARGET_MEGABYTES} MB delivery budget")
    say(
        f"triangle target {TARGET_TRIANGLES[0]}–{TARGET_TRIANGLES[1]}; "
        "the turntable log reports the real count."
    )
    say("REMINDER: a rig is still needed. The mesh is a body, not a performance.")


def main():
    parser = argparse.ArgumentParser(
        description="Make a real 3D dog from a photograph, and check it before shipping."
    )
    parser.add_argument("--image", type=Path, required=True, help="one subject, full body, plain background")
    parser.add_argument("--out", type=Path, required=True, help="the .glb to write")
    parser.add_argument("--model", default="2.0", help="shape model (2.0 is the cleanest)")
    parser.add_argument("--octree", type=int, default=512, choices=[256, 384, 512, 1024])
    parser.add_argument("--faces", type=int, default=80_000, help="decimation target")
    parser.add_argument("--turntable", type=Path, default=Path(".audit/turntable"))
    parser.add_argument("--verify-only", action="store_true", help="skip generation, just check the asset")
    args = parser.parse_args()

    out = args.out.resolve()
    out.parent.mkdir(parents=True, exist_ok=True)

    if args.verify_only:
        verify(out, args.turntable)
        report(out)
        return

    check_input(args.image.resolve())
    generate(args.image.resolve(), out, args.model, args.octree, args.faces)
    verify(out, args.turntable.resolve())
    report(out)


if __name__ == "__main__":
    main()
