"""Bake independent day/night vertex illumination for the added window seating."""
from pathlib import Path
import json,time
ROOT=Path(__file__).resolve().parents[1];pipeline=(ROOT/'tools/bake-room-lighting.py').read_text()
prefix=pipeline[:pipeline.index('corner_attribute=')]
prefix=prefix.replace("for data in source['meshes']:","for item in source['meshes']:\n    if item.get('seating'):item['softgoods']=True\nfor data in source['meshes']:")
exec(prefix);exec(pipeline[pipeline.index('I=.0254'):pipeline.index('atlas=')])
import os
if os.environ.get('ROOM_BAKE_CPU')=='1':scene.cycles.device='CPU'
scene.cycles.samples=128 if scene.cycles.device=='CPU' else 512;output=ROOT/'Textures/Seating';output.mkdir(exist_ok=True)
seating={m['id'] for m in source['meshes'] if m.get('seating')};selected=[r for r in records if r['id'] in seating]
if not selected:raise RuntimeError('Run export-room.cjs --include-seating first')
# Seating occupies a contiguous range in the exported room. Keep the room as a ray-traced
# backdrop, but bake only the added pieces instead of all the old wall corners.
first_corner=selected[0]['offset'];first_face=first_corner//3;last_face=(selected[-1]['offset']+selected[-1]['count'])//3
if sum(r['count'] for r in selected)!=(last_face-first_face)*3:raise RuntimeError('Seating must be contiguous in the export')
def section(name,indices):
    result=bpy.data.meshes.new(name);result.from_pydata(verts,[],[faces[i] for i in indices]);result.update()
    for material in materials:result.materials.append(material)
    for poly,i in zip(result.polygons,indices):poly.material_index=face_materials[i];poly.use_smooth=smooth[i]
    return result
old_mesh=mesh;room.data=section('Room backdrop',list(range(first_face))+list(range(last_face,len(faces))));room.select_set(False)
mesh=section('Seating bake target',range(first_face,last_face));target=bpy.data.objects.new('Seating bake target',mesh);bpy.context.collection.objects.link(target);target.select_set(True);bpy.context.view_layer.objects.active=target
bpy.data.meshes.remove(old_mesh)
attribute=mesh.color_attributes.new(name='SeatingGI',type='FLOAT_COLOR',domain='CORNER');mesh.color_attributes.active_color=attribute;scene.render.bake.target='VERTEX_COLORS'
manifest={'samples':scene.cycles.samples,'records':[]};offset=0
for r in selected:manifest['records'].append({'id':r['id'],'count':r['count'],'offset':offset});offset+=r['count']
for mode in ['day','night']:
    for obj in day:obj.hide_render=mode!='day'
    for obj in night:obj.hide_render=mode!='night'
    world.inputs['Strength'].default_value=.045 if mode=='day' else .0005;started=time.time();print('SEATING_BAKE_START',mode,flush=True)
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},use_clear=True)
    colors=np.empty(len(mesh.loops)*4,dtype=np.float32);attribute.data.foreach_get('color',colors);colors=colors.reshape(-1,4)
    values=np.concatenate([colors[r['offset']-first_corner:r['offset']-first_corner+r['count'],:3] for r in selected])
    if not np.isfinite(values).all() or values.max()<.00001:raise RuntimeError('Invalid seating illumination')
    values.astype(np.float16).tofile(output/f'{mode}.bin');print('SEATING_BAKE_COMPLETE',mode,'seconds',round(time.time()-started),flush=True)
(output/'manifest.json').write_text(json.dumps(manifest,separators=(',',':')))
import runpy
runpy.run_path(str(ROOT/'tools/smooth-seating-lighting.py'),run_name='__main__')
