"""Bake independent day/night vertex illumination for the added window seating."""
from pathlib import Path
import json,time
ROOT=Path(__file__).resolve().parents[1];pipeline=(ROOT/'tools/bake-room-lighting.py').read_text()
prefix=pipeline[:pipeline.index('corner_attribute=')]
prefix=prefix.replace("for data in source['meshes']:","for item in source['meshes']:\n    if item.get('seating'):item['softgoods']=True\nfor data in source['meshes']:")
exec(prefix);exec(pipeline[pipeline.index('I=.0254'):pipeline.index('atlas=')])
scene.cycles.samples=512;output=ROOT/'Textures/Seating';output.mkdir(exist_ok=True)
seating={m['id'] for m in source['meshes'] if m.get('seating')};selected=[r for r in records if r['id'] in seating]
if not selected:raise RuntimeError('Run export-room.cjs --include-seating first')
attribute=mesh.color_attributes.new(name='SeatingGI',type='FLOAT_COLOR',domain='CORNER');mesh.color_attributes.active_color=attribute;scene.render.bake.target='VERTEX_COLORS'
manifest={'samples':512,'records':[]};offset=0
for r in selected:manifest['records'].append({'id':r['id'],'count':r['count'],'offset':offset});offset+=r['count']
for mode in ['day','night']:
    for obj in day:obj.hide_render=mode!='day'
    for obj in night:obj.hide_render=mode!='night'
    world.inputs['Strength'].default_value=.045 if mode=='day' else .0005;started=time.time();print('SEATING_BAKE_START',mode,flush=True)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},use_clear=True)
    colors=np.empty(len(mesh.loops)*4,dtype=np.float32);attribute.data.foreach_get('color',colors);colors=colors.reshape(-1,4)
    values=np.concatenate([colors[r['offset']:r['offset']+r['count'],:3] for r in selected])
    if not np.isfinite(values).all() or values.max()<.00001:raise RuntimeError('Invalid seating illumination')
    values.astype(np.float16).tofile(output/f'{mode}.bin');print('SEATING_BAKE_COMPLETE',mode,'seconds',round(time.time()-started),flush=True)
(output/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
