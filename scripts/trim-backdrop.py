"""Trim the backdrop out of a generated mesh, and keep the texture.

THE PROBLEM
-----------
An image-to-3D pipeline reconstructs what it can see, and a studio photograph
has a seamless backdrop in it. So the reconstruction sometimes carries a big
flat panel behind the animal, welded into the same mesh. The panel is not a
separate object: it is loose geometry in the same buffer, and it inflates the
model's bounding box so every framing calculation is wrong.

THE FIX
-------
Separate the mesh into loose parts, then drop the ones that are FLAT — a
backdrop has one very large extent and two very small ones, and a dog does
not. The parts are rejoined and re-exported with the original material and
UVs, so the texture survives.

    blender --background --python scripts/trim-backdrop.py -- in.glb out.glb
"""

import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src = os.path.abspath(argv[0])
dst = os.path.abspath(argv[1])

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("no mesh in the file")

obj = meshes[0]
bpy.ops.object.select_all(action="DESELECT")
obj.select_set(True)
bpy.context.view_layer.objects.active = obj

# SPLIT THE LOOSE PARTS.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")
bpy.context.view_layer.update()

parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
print(f"[trim] {len(parts)} loose part(s)")

# THE WHOLE MESH'S BOUNDS, which every part is judged against.
all_verts = [v.co for part in parts for v in part.data.vertices]
whole_lo = Vector((min(v.x for v in all_verts), min(v.y for v in all_verts), min(v.z for v in all_verts)))
whole_hi = Vector((max(v.x for v in all_verts), max(v.y for v in all_verts), max(v.z for v in all_verts)))
whole = whole_hi - whole_lo
print(f"[trim] whole mesh extent ({whole.x:.3f},{whole.y:.3f},{whole.z:.3f})")

# JUDGE EACH PART AGAINST THE WHOLE.
#
# A backdrop spans most of the picture in two directions and is paper-thin in
# the third. An animal part is never both large AND thin — even the fur is
# clumped, not sheet-like.
scored = []
for part in parts:
    verts = [v.co for v in part.data.vertices]
    if not verts:
        continue
    lo = Vector((min(v.x for v in verts), min(v.y for v in verts), min(v.z for v in verts)))
    hi = Vector((max(v.x for v in verts), max(v.y for v in verts), max(v.z for v in verts)))
    extent = hi - lo
    sides = sorted((extent.x, extent.y, extent.z))
    flatness = sides[0] / max(sides[2], 1e-9)
    # How much of the whole picture this part spans, on each axis.
    spans = [extent.x / max(whole.x, 1e-9), extent.y / max(whole.y, 1e-9), extent.z / max(whole.z, 1e-9)]
    volume = extent.x * extent.y * extent.z
    scored.append((part, flatness, volume, tuple(extent), spans))

for part, flatness, volume, extent, spans in sorted(scored, key=lambda s: -s[2])[:8]:
    print(
        f"[trim] {part.name!r} faces={len(part.data.polygons):>7} "
        f"extent=({extent[0]:.3f},{extent[1]:.3f},{extent[2]:.3f}) "
        f"flatness={flatness:.4f} spans=({spans[0]:.2f},{spans[1]:.2f},{spans[2]:.2f})"
    )

# THE BACKDROP: big in two axes, paper-thin in the third, and it covers the
# whole picture. An animal part is never both.
dropped = 0
for part, flatness, volume, extent, spans in scored:
    wide = sum(1 for s in spans if s > 0.65)
    thin = flatness < 0.12
    if wide >= 2 and thin:
        print(f"[trim] dropping backdrop {part.name!r} flatness={flatness:.4f} spans={spans}")
        bpy.data.objects.remove(part, do_unlink=True)
        dropped += 1
print(f"[trim] dropped {dropped} backdrop part(s)")

# REJOIN, KEEPING THE MATERIAL AND THE UVS.
bpy.ops.object.select_all(action="DESELECT")
for part in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    part.select_set(True)
bpy.context.view_layer.objects.active = [o for o in bpy.context.scene.objects if o.type == "MESH"][0]
bpy.ops.object.join()

obj = bpy.context.view_layer.objects.active
obj.name = "dog"

# Separating a mesh into loose parts SPLITS the vertices at every boundary,
# so joining them back leaves three times as many vertices as it started
# with. Weld them again: the model was one mesh before, and it should be one
# mesh after.
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.remove_doubles(threshold=1e-5)
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.update()
lo = Vector((min(v.co.x for v in obj.data.vertices), min(v.co.y for v in obj.data.vertices), min(v.co.z for v in obj.data.vertices)))
hi = Vector((max(v.co.x for v in obj.data.vertices), max(v.co.y for v in obj.data.vertices), max(v.co.z for v in obj.data.vertices)))
print(
    f"[trim] kept bounds {tuple(round(v, 3) for v in hi - lo)} "
    f"verts={len(obj.data.vertices)} faces={len(obj.data.polygons)} "
    f"materials={[m.name for m in obj.data.materials]}"
)

os.makedirs(os.path.dirname(dst) or ".", exist_ok=True)
bpy.ops.export_scene.gltf(
    filepath=dst,
    export_format="GLB",
    export_apply=True,
    export_texcoords=True,
    export_normals=True,
    export_materials="EXPORT",
)
print(f"[trim] wrote {dst}")
