"""Render a mesh from four sides so the geometry can be judged by eye.

The spatial law's rule applies to models too: one good render is not proof.
A mesh can look right from the front and be fused, doubled or missing its
tail from behind.

    blender --background --python scripts/render-turntable.py -- mesh.obj outdir
"""
import os
import sys
import math

import bpy
from bpy_extras.object_utils import world_to_camera_view
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
mesh_path = os.path.abspath(argv[0])
out_dir = os.path.abspath(argv[1])
os.makedirs(out_dir, exist_ok=True)

# Clean the file.
bpy.ops.wm.read_factory_settings(use_empty=True)

# Import.
if mesh_path.endswith(".glb") or mesh_path.endswith(".gltf"):
    bpy.ops.import_scene.gltf(filepath=mesh_path)
else:
    bpy.ops.wm.obj_import(filepath=mesh_path)

meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
if not meshes:
    raise SystemExit("no mesh in the file")

# Join everything into one object so the bounds are the whole animal.
bpy.ops.object.select_all(action="DESELECT")
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active

# Ground it: the animal stands on z = 0.
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
bpy.context.view_layer.update()
low = min((obj.matrix_world @ Vector(c)).z for c in obj.bound_box)
obj.location.z -= low
bpy.context.view_layer.update()

verts = obj.data.vertices
corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
xs, ys, zs = zip(*corners)
print(
    f"[turntable] verts={len(verts)} faces={len(obj.data.polygons)} "
    f"x=[{min(xs):.3f},{max(xs):.3f}] y=[{min(ys):.3f},{max(ys):.3f}] z=[{min(zs):.3f},{max(zs):.3f}]"
)

# A plain grey material, so the geometry is what is being judged.
mat = bpy.data.materials.new("judge")
mat.use_nodes = True
bsdf = mat.node_tree.nodes["Principled BSDF"]
bsdf.inputs["Base Color"].default_value = (0.55, 0.55, 0.57, 1)
bsdf.inputs["Roughness"].default_value = 0.75
obj.data.materials.clear()
obj.data.materials.append(mat)

# Light and world.
bpy.ops.object.light_add(type="SUN", location=(4, -6, 8))
sun = bpy.context.object
sun.data.energy = 3.0
sun.rotation_euler = (math.radians(50), 0, math.radians(35))
bpy.ops.object.light_add(type="AREA", location=(-4, -3, 5))
fill = bpy.context.object
fill.data.energy = 400
fill.data.size = 6

world = bpy.data.worlds.new("judge-world")
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.06, 0.06, 0.07, 1)

# Camera, framed on the real bounds.
scene = bpy.context.scene
scene.render.resolution_x = 900
scene.render.resolution_y = 900
scene.render.film_transparent = False
scene.render.image_settings.file_format = "PNG"

cam_data = bpy.data.cameras.new("cam")
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

# The camera LOOKS at the animal. A hand-written Euler triple does not
# survive a change of subject; a track-to constraint does.
focus = bpy.data.objects.new("focus", None)
scene.collection.objects.link(focus)
constraint = cam.constraints.new("TRACK_TO")
constraint.target = focus
constraint.track_axis = "TRACK_NEGATIVE_Z"
constraint.up_axis = "UP_Y"

height = max(zs) - min(zs)
# Frame the entire world-space box, including imported offsets and rotation.
target = Vector(tuple((min(axis) + max(axis)) / 2 for axis in (xs, ys, zs)))
radius = max((corner - target).length for corner in corners)
half_fov = min(cam_data.angle_x, cam_data.angle_y) / 2
dist = radius / math.sin(half_fov * 0.88)

focus.location = target

for name, angle in (("front", 180), ("right", 90), ("back", 0), ("left", 270)):
    rad = math.radians(angle)
    cam.location = (
        target.x + dist * math.cos(rad),
        target.y + dist * math.sin(rad),
        target.z + height * 0.28,
    )
    bpy.context.view_layer.update()
    for corner in corners:
        p = world_to_camera_view(scene, cam, corner)
        if p.z <= cam_data.clip_start or not (0.04 < p.x < 0.96 and 0.04 < p.y < 0.96):
            raise RuntimeError(f"{name}: subject bounds leave the framing margin")
    scene.render.filepath = os.path.join(out_dir, f"{name}.png")
    bpy.ops.render.render(write_still=True)
    print(f"[turntable] wrote {scene.render.filepath}")

print("[turntable] done")
