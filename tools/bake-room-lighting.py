"""Bake static diffuse day/night illumination on the exact exported room.

Run tools/export-room.cjs first, then Blender --background --python this file.
The small runtime UV binary preserves the original room's materials and layout.
"""
import bpy,json,math,struct,time
from pathlib import Path
import numpy as np
import importlib.util
spec=importlib.util.spec_from_file_location('denoise_lightmap',str(Path(__file__).resolve().parent/'denoise-lightmap.py'))
denoiser=importlib.util.module_from_spec(spec);spec.loader.exec_module(denoiser)
from pathlib import Path
from mathutils import Vector

ROOT=Path(__file__).resolve().parents[1];OUT=ROOT/'Textures/Lighting';OUT.mkdir(exist_ok=True)
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=json.loads((ROOT/'previews/blender-scene.json').read_text())
scene=bpy.context.scene;scene.render.engine='CYCLES';scene.cycles.samples=512
scene.cycles.max_bounces=8;scene.cycles.diffuse_bounces=5;scene.cycles.glossy_bounces=2
scene.cycles.use_denoising=True
prefs=bpy.context.preferences.addons['cycles'].preferences
try:
    prefs.compute_device_type='CUDA';prefs.get_devices()
    for device in prefs.devices:device.use=device.type!='CPU'
    scene.cycles.device='GPU';print('BAKE_GPU',[(d.name,d.use) for d in prefs.devices],flush=True)
except Exception as error: print('GPU unavailable, using CPU',error,flush=True)
scene.world.use_nodes=True
world=scene.world.node_tree.nodes.get('Background');world.inputs['Color'].default_value=(.42,.57,.8,1)

verts=[];faces=[];face_materials=[];smooth=[];records=[];materials=[];material_lookup={}
for data in source['meshes']:
    start=len(verts);p=data['positions'];verts.extend((p[i],-p[i+2],p[i+1]) for i in range(0,len(p),3))
    indices=data['indices'] or list(range(len(p)//3));count=len(indices)//3
    records.append(dict(id=data['id'],offset=len(faces)*3,count=count*3,softgoods=bool(data['softgoods'])))
    faces.extend(tuple(start+v for v in indices[i:i+3]) for i in range(0,len(indices),3))
    key=tuple(round(v,4) for v in data['color'])+(round(data['emissiveIntensity'],2),)
    if key not in material_lookup:
        mat=bpy.data.materials.new('Room finish '+str(len(materials)));mat.use_nodes=True
        bsdf=mat.node_tree.nodes.get('Principled BSDF');bsdf.inputs['Base Color'].default_value=(*data['color'],1)
        bsdf.inputs['Roughness'].default_value=max(.35,data['roughness']);bsdf.inputs['Metallic'].default_value=0
        material_lookup[key]=len(materials);materials.append(mat)
    face_materials.extend([material_lookup[key]]*count);smooth.extend([bool(data['softgoods'])]*count)
mesh=bpy.data.meshes.new('Exact room and refined furnishings');mesh.from_pydata(verts,[],faces);mesh.update()
room=bpy.data.objects.new('Baked room',mesh);bpy.context.collection.objects.link(room);bpy.context.view_layer.objects.active=room;room.select_set(True)
for mat in materials:mesh.materials.append(mat)
for poly,mi,sm in zip(mesh.polygons,face_materials,smooth):poly.material_index=mi;poly.use_smooth=sm
mesh.uv_layers.new(name='Lightmap')
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.004,area_weight=.7,correct_aspect=True,scale_to_bounds=True)
bpy.ops.object.mode_set(mode='OBJECT')
uv=mesh.uv_layers.active.data
values=np.empty(len(uv)*2,dtype=np.float32);uv.foreach_get('uv',values);values.tofile(OUT/'room-uv.bin')
print('BAKE_GEOMETRY',len(verts),len(faces),'UV loops',len(uv),flush=True)

I=.0254
def C(p):return Vector((p[0]*I,-p[2]*I,p[1]*I))
def area(name,position,target,energy,color,size):
    data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.color=color;data.shape='RECTANGLE';data.size=size[0];data.size_y=size[1]
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=C(position);obj.rotation_euler=(C(target)-obj.location).to_track_quat('-Z','Y').to_euler();return obj
day=[];night=[]
day.append(area('Paired daylight window',(60.5,56,-2),(62,42,145),230,(.78,.87,1),(1.8,1.4)))
day.append(area('Front daylight window',(-2,56,42),(95,40,90),145,(.82,.89,1),(.86,1.4)))
day.append(area('Upper sky opening',(-2,140,163),(70,72,140),60,(.72,.84,1),(.7,.7)))
sun_data=bpy.data.lights.new('Day sun','SUN');sun_data.energy=2;sun_data.angle=math.radians(2.5)
sun=bpy.data.objects.new('Day sun',sun_data);bpy.context.collection.objects.link(sun);sun.location=(-6,7,9);sun.rotation_euler=(Vector((1,-2,0))-sun.location).to_track_quat('-Z','Y').to_euler();day.append(sun)
for x in [12,112]:
    night.append(area('Opal bedside sconce',(x,67,178),(x,54,145),12,(1,.75,.48),(.07,.23)))
    night.append(area('Sconce wall wash',(x,67,181),(x,68,187),4,(1,.75,.48),(.05,.2)))
night.append(area('Bed picture light',(62,86,178),(62,71,185),9,(1,.78,.53),(.8,.04)))
night.append(area('Tall picture light',(139.5,86,8),(139.5,55,3),7,(1,.78,.53),(.4,.035)))
# A very low outdoor contribution keeps the window-side recesses readable.
night.append(area('Night exterior fill',(60.5,56,-2),(62,42,145),.8,(.45,.57,1),(1.8,1.4)))

atlas=bpy.data.images.new('Room illumination',width=2048,height=2048,alpha=True,float_buffer=True)
atlas.colorspace_settings.name='Non-Color'
for mat in materials:
    node=mat.node_tree.nodes.new('ShaderNodeTexImage');node.image=atlas;mat.node_tree.nodes.active=node
scene.render.bake.margin=8;scene.render.bake.use_clear=True
metadata={'size':2048,'records':records,'modes':{},'geometry':'day/night diffuse lighting, Blender Cycles 512 samples, 5 diffuse bounces'}
for mode in ['day','night']:
    scene.render.bake.target='IMAGE_TEXTURES'
    for obj in day:obj.hide_render=mode!='day'
    for obj in night:obj.hide_render=mode!='night'
    world.inputs['Strength'].default_value=.045 if mode=='day' else .0005
    print('BAKE_START',mode,flush=True);started=time.time()
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},use_clear=True)
    pixels=np.empty(2048*2048*4,dtype=np.float32);atlas.pixels.foreach_get(pixels)
    rgb=pixels.reshape(-1,4)[:,:3];rgb[:]=denoiser.denoise(rgb.reshape(2048,2048,3)).reshape(-1,3);positive=rgb[np.max(rgb,axis=1)>.00001]
    if not positive.size:raise RuntimeError('Lighting bake returned no illumination; check the Cycles device log')
    np.save(ROOT/'previews'/f'light-{mode}.npy',np.maximum(rgb.reshape(2048,2048,3),0))
    maximum=max(.125,float(np.quantile(positive,.9995))) if positive.size else 1
    scale=2**math.ceil(math.log2(maximum));rgb[:]=np.clip(rgb/scale,0,1)
    pixels.reshape(-1,4)[:,3]=1;atlas.pixels.foreach_set(pixels)
    atlas.filepath_raw=str(OUT/f'room-{mode}.png');atlas.file_format='PNG';atlas.save()
    metadata['modes'][mode]={'image':f'room-{mode}.hdr','mobileImage':f'room-{mode}-mobile.hdr','scale':1}
    atlas.scale(1024,1024);atlas.filepath_raw=str(OUT/f'room-{mode}-mobile.png');atlas.save();atlas.scale(2048,2048)
    # Thin, double-sided fabrics use continuous vertex illumination instead of
    # sampling tightly packed atlas islands at sewn edges and narrow folds.
    scene.render.bake.target='VERTEX_COLORS'
    attribute=mesh.color_attributes.get('ClothGI') or mesh.color_attributes.new(name='ClothGI',type='FLOAT_COLOR',domain='CORNER')
    mesh.color_attributes.active_color=attribute
    bpy.ops.object.bake(type='DIFFUSE',pass_filter={'DIRECT','INDIRECT'},use_clear=True)
    colors=np.empty(len(mesh.loops)*4,dtype=np.float32);attribute.data.foreach_get('color',colors);colors=colors.reshape(-1,4)
    cloth=[];vertex_offset=0
    for record in records:
        if record['softgoods']:
            record['vertexOffset']=vertex_offset;vertex_offset+=record['count']
            cloth.append(colors[record['offset']:record['offset']+record['count'],:3])
    np.concatenate(cloth).astype(np.float16).tofile(OUT/f'cloth-{mode}.bin')
    print('BAKE_COMPLETE',mode,'scale',scale,'seconds',round(time.time()-started),flush=True)
(OUT/'manifest.json').write_text(json.dumps(metadata,separators=(',',':')))
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'previews/lighting-bake.blend'))
print('LIGHTING_COMPLETE',flush=True)
