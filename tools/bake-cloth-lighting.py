"""Refresh cloth vertex GI without repacking the unchanged room light atlas.

The cloth edit preserves mesh order and triangle counts. Existing static-room
UVs and filtered HDR lighting stay intact; new cloth-to-cloth contacts are baked
with the same room lights and bounce settings as the original quality pass.
"""
from pathlib import Path
import json,time
ROOT=Path(__file__).resolve().parents[1]
pipeline=(ROOT/'tools/bake-room-lighting.py').read_text()
exec(pipeline[:pipeline.index('corner_attribute=')])
exec(pipeline[pipeline.index('I=.0254'):pipeline.index('atlas=')])
scene.cycles.samples=512
manifest=json.loads((OUT/'manifest.json').read_text())
if [(r['id'],r['offset'],r['count'],r['softgoods']) for r in records] != [(r['id'],r['offset'],r['count'],r['softgoods']) for r in manifest['records']]:
    raise RuntimeError('Cloth-only bake requires unchanged mesh order and triangle counts')
attribute=mesh.color_attributes.new(name='ClothGI',type='FLOAT_COLOR',domain='CORNER');mesh.color_attributes.active_color=attribute
scene.render.bake.target='VERTEX_COLORS'
for mode in ['day','night']:
    for obj in day:obj.hide_render=mode!='day'
    for obj in night:obj.hide_render=mode!='night'
    world.inputs['Strength'].default_value=.045 if mode=='day' else .0005
    started=time.time();print('CLOTH_BAKE_START',mode,flush=True)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},use_clear=True)
    colors=np.empty(len(mesh.loops)*4,dtype=np.float32);attribute.data.foreach_get('color',colors);colors=colors.reshape(-1,4)
    cloth=np.concatenate([colors[r['offset']:r['offset']+r['count'],:3] for r in records if r['softgoods']])
    if not np.isfinite(cloth).all() or cloth.max()<.00001:raise RuntimeError('Invalid cloth illumination')
    cloth.astype(np.float16).tofile(OUT/f'cloth-{mode}.bin')
    print('CLOTH_BAKE_COMPLETE',mode,'seconds',round(time.time()-started),flush=True)
