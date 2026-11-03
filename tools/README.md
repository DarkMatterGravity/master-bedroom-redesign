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
python tools/encode-lightmaps.py
node tools/verify-quality.cjs
node verify.cjs
```

The local server must be running. The browser exporter bypasses existing bakes
so they can be rebuilt after geometry changes. Host Python needs NumPy/OpenCV;
Blender uses its included Python, CUDA Cycles and Open Image Denoise. The bake
uses 512 samples and five diffuse bounces, with separate day/night lighting.
CUDA is selected explicitly for this machine.

For hand edits in Blender, export the GLB from the edited blend instead of
rerunning `refine-softgoods.py`, then export the room and rebuild its bakes.
Light placement, room geometry, and furniture movement require a new bake.
Changing camera position does not. Light maps contain diffuse light; moving
reflections are computed in the browser from a filtered room cubemap.

The Blender scripts create technical mesh/light-map assets, not architectural
still images. Browser screenshots and intermediate baking files stay in the
ignored `previews/` directory. Three.js add-ons are pinned to r180 and covered
by `vendor/LICENSE`.
