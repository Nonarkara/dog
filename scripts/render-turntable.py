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
# A GLB can carry a stray backdrop quad. A judge should not photograph it.
if len(meshes) > 1:
    biggest = max(meshes, key=lambda o: len(o.data.polygons))
    meshes = [o for o in meshes if o is biggest or len(o.data.polygons) > 20000]

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

# SMOOTH THE RECONSTRUCTION NOISE.
#
# The shape stage reconstructs fur as spikes. Two light passes of a Laplacian
# smooth remove the noise without eating the silhouette — the texture, when
# it lands, carries the fur; the geometry only has to carry the animal.
for _ in range(2):
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.vertices_smooth(factor=0.5, repeat=1)
    bpy.ops.object.mode_set(mode="OBJECT")

verts = obj.data.vertices
corners = [obj.matrix_world @ Vector(c) for c in obj.bound_box]
xs, ys, zs = zip(*corners)
print(
    f"[turntable] verts={len(verts)} faces={len(obj.data.polygons)} "
    f"x=[{min(xs):.3f},{max(xs):.3f}] y=[{min(ys):.3f},{max(ys):.3f}] z=[{min(zs):.3f},{max(zs):.3f}]"
)

# A plain grey material, so the geometry is what is being judged.
# A GLB already carries its own PBR material, and the POINT of judging a
# textured model is to look at the texture. So the model's own material is
# kept; a plain grey one is substituted only for a bare mesh, where the
# geometry is the only thing there is to judge.
if not (mesh_path.endswith(".glb") or mesh_path.endswith(".gltf")):
    mat = bpy.data.materials.new("judge")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (0.62, 0.60, 0.58, 1)
    bsdf.inputs["Roughness"].default_value = 0.72
    obj.data.materials.clear()
    obj.data.materials.append(mat)

world = bpy.data.worlds.new("judge-world")
bpy.context.scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.05, 0.05, 0.06, 1)

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

# THE LIGHT GOES WITH THE CAMERA.
#
# A key light on the far side of the subject renders a silhouette, and a
# silhouette is not evidence of a model. So the sun travels with the camera
# around the turntable, with a soft fill opposite and a low rim to lift the
# dark coat off the dark ground.
sun_data = bpy.data.lights.new("sun", type="SUN")
sun_data.energy = 2.2
sun = bpy.data.objects.new("sun", sun_data)
scene.collection.objects.link(sun)
sun.parent = cam
sun.location = (2.5, -3.5, 4.0)
sun.rotation_euler = (math.radians(45), 0, math.radians(35))

fill_data = bpy.data.lights.new("fill", type="AREA")
fill_data.energy = 260
fill_data.size = 8
fill = bpy.data.objects.new("fill", fill_data)
scene.collection.objects.link(fill)
fill.parent = cam
fill.location = (-3.5, 2.5, 2.5)
fill.rotation_euler = (math.radians(65), 0, math.radians(-125))

rim_data = bpy.data.lights.new("rim", type="AREA")
rim_data.energy = 180
rim_data.size = 5
rim = bpy.data.objects.new("rim", rim_data)
scene.collection.objects.link(rim)
rim.parent = cam
rim.location = (-1.5, 4.0, 1.2)
rim.rotation_euler = (math.radians(80), 0, math.radians(-160))

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
