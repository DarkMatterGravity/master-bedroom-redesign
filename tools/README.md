# Interactive quality asset pipeline

The viewer keeps its original procedural room and measured layout. The After
variant adds Blender-refined soft goods, baked diffuse illumination, HDR room
reflections, cloth sheen, and restrained clearcoat on wood. Before uses the
original materials/lighting without baked maps or environment lighting.

Files:

- `Assets/softgoods.blend`: editable Blender source for the fabric meshes.
- `Assets/softgoods.glb`: optimized browser mesh, including sewn pillow edges.
- `Textures/Lighting/room-*.hdr`: linear HDR diffuse bakes, 2048px desktop and
  1024px mobile. RGBE encoding preserves dark gradients without colored bands.
- `Textures/Lighting/room-uv.bin` and `manifest.json`: the matching second UV
  channel and mesh assignments. These depend on the room geometry/hierarchy.
- `Textures/Lighting/cloth-*.bin`: half-float per-corner irradiance for fabrics.
  This keeps lighting continuous at narrow folds and sewn edges, where a packed
  texture atlas can leave seams on very thin, double-sided surfaces.
- `quality.js`: asset loading and day/night/before material switching.
- `glass.js`: cached room capture and PMREM filtering for material reflections.

Rebuild from the project root on this Windows machine (Blender 5.2 installed):

```powershell
$env:PLAYWRIGHT_PATH = 'C:/Users/mattl/AppData/Local/npm-cache/_npx/420ff84f11983ee5/node_modules/playwright'
node tools/export-room.cjs --original-softgoods
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 8 --python tools/refine-softgoods.py
node tools/export-room.cjs
& 'C:/Program Files/Blender Foundation/Blender 5.2/blender.exe' -b -t 8 --python tools/bake-room-lighting.py
python tools/check-lightmap-seams.py
python tools/smooth-lightmaps.py
python tools/encode-lightmaps.py
python tools/stitch-wall-lighting.py
python tools/soften-painted-edges.py
node tools/verify-quality.cjs
node verify.cjs
```

The local server must be running. The browser exporter bypasses existing bakes
so they can be rebuilt after geometry changes. Host Python needs NumPy/OpenCV;
Blender uses its included Python, CUDA Cycles and Open Image Denoise. The bake
uses 1024 samples and five diffuse bounces, with separate day/night lighting.
CUDA is selected explicitly for this machine.

The baker welds coincident vertices within each mesh before unwrapping, while
preserving the original runtime triangle-corner correspondence. Flat surfaces
therefore share continuous UV charts instead of a separate island per triangle.
The seam check tests 679 shared edges on the current model. Denoising and
residual-noise filtering stay inside each chart; world-space wall filtering
joins lighting across the separate eight-foot walls and vaulted extensions.
Corner filtering limits exaggerated dark bands at the hallway return, and
painted-edge filtering softens dark moulding side faces and rebuilds atlas
gutters. Door inset outlines share the white eggshell trim finish.
The room's painted walls/panel faces are soft white (`#eeeae4`) with a satin
roughness of 0.42. Mouldings use an eggshell roughness of 0.6. Before retains
its original palette and finish settings.

For hand edits in Blender, export the GLB from the edited blend instead of
rerunning `refine-softgoods.py`, then export the room and rebuild its bakes.
Light placement, room geometry, and furniture movement require a new bake.
Changing camera position does not. Light maps contain diffuse light; moving
reflections are computed in the browser from a filtered room cubemap.

The Blender scripts create technical mesh/light-map assets, not architectural
still images. Browser screenshots and intermediate baking files stay in the
ignored `previews/` directory. Three.js add-ons are pinned to r180 and covered
by `vendor/LICENSE`.
