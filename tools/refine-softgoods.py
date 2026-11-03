"""Create clean, lightweight cloth assets from the original room geometry."""
import bpy,bmesh,json,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
source=json.loads((ROOT/'previews/blender-scene.json').read_text())
roles={}
for role in ['white','pattern','slate','curtain']:
 mat=bpy.data.materials.new(role);mat.diffuse_color=(.75,.72,.66,1);roles[role]=mat

def signed(value,power=.65):return math.copysign(abs(value)**power,value)
def point(matrix,p):
 w=matrix@Vector((*p,1));return (w.x,-w.z,w.y)
for number,data in enumerate(m for m in source['meshes'] if m['softgoods']):
 role=data['softgoods'];name=f"refined-{data['name']}-{number}"
 if data.get('dimensions'):
  dims=data['dimensions'];a=data['transform'];matrix=Matrix([a[i::4] for i in range(4)])
  bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,radius=1)
  obj=bpy.context.object;obj.name=name;mesh=obj.data;local={}
  for v in mesh.vertices:
   p=[signed(v.co[k])*dims[k]/2 for k in range(3)]
   p[2]+=.0008*math.sin(p[0]*42)*math.cos(p[1]*39)
   local[v.index]=p;v.co=point(matrix,p)
  for loop in mesh.loops:
   p=local[loop.vertex_index];mesh.uv_layers.active.data[loop.index].uv=(p[0]/dims[0]+.5,p[1]/dims[1]+.5)
  curve=bpy.data.curves.new('Fine sewn pillow edge','CURVE');curve.dimensions='3D';curve.bevel_depth=.0009;curve.bevel_resolution=1
  spline=curve.splines.new('POLY');spline.points.add(95)
  for i,knot in enumerate(spline.points):
   t=i*math.tau/96;knot.co=(*point(matrix,(signed(math.cos(t))*dims[0]/2,signed(math.sin(t))*dims[1]/2,0)),1)
  spline.use_cyclic_u=True
  seam=bpy.data.objects.new(name+'-seam',curve);bpy.context.collection.objects.link(seam);curve.materials.append(roles['white' if role=='pattern' else role]);seam['materialRole']='white' if role=='pattern' else role
 else:
  sx,sy=data['grid'];step=4 if role=='curtain' else 3
  xs=list(range(0,sx,step))+[sx];ys=list(range(0,sy,step))+[sy];vertices=[];uvs=[]
  for y in ys:
   for x in xs:
    index=y*(sx+1)+x;p=data['positions'][index*3:index*3+3];vertices.append((p[0],-p[2],p[1]));uvs.append(data['uv'][index*2:index*2+2])
  nx=len(xs);faces=[]
  for y in range(len(ys)-1):
   for x in range(nx-1):
    a=y*nx+x;b=(y+1)*nx+x;faces.append((a,b,b+1,a+1))
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(vertices,[],faces);mesh.update();uv=mesh.uv_layers.new(name='UVMap')
  for loop in mesh.loops:uv.data[loop.index].uv=uvs[loop.vertex_index]
  obj=bpy.data.objects.new(name,mesh);bpy.context.collection.objects.link(obj);bpy.context.view_layer.objects.active=obj
  if role=='curtain':
   bounds=[(min(v.co[k] for v in mesh.vertices),max(v.co[k] for v in mesh.vertices)) for k in range(3)]
   wide=0 if bounds[0][1]-bounds[0][0]>.15 else 1;depth=1-wide
   for v in mesh.vertices:
    t=(v.co.z-bounds[2][0])/(bounds[2][1]-bounds[2][0]);u=(v.co[wide]-bounds[wide][0])/(bounds[wide][1]-bounds[wide][0])
    v.co[depth]+=(1-t)**1.3*(.007*math.sin(u*7.2+t*3.4+number)+.003*math.sin(u*19-t*5));v.co.z+=.003*math.sin(u*8+number)*(1-t)**8
  else:
   for v in mesh.vertices:
    # Broad, shallow folds remain visible under soft light without crumpling
    # the bed or intersecting the separately layered throw.
    v.co.z+=(.006 if 'duvet' in data['name'] else .004)*math.sin(v.co.x*17-v.co.y*9)+.003*math.sin(v.co.x*31+v.co.y*15)
  sub=obj.modifiers.new('Continuous woven surface','SUBSURF');sub.levels=1;bpy.ops.object.modifier_apply(modifier=sub.name)
  solid=obj.modifiers.new('Finished cloth thickness','SOLIDIFY');solid.thickness=.0025 if role!='curtain' else .0008;solid.offset=0;bpy.ops.object.modifier_apply(modifier=solid.name)
 obj['materialRole']=role;obj.data.materials.append(roles[role])
 for poly in obj.data.polygons:poly.use_smooth=True
 obj.select_set(False)
# Convert sewn curves to renderable meshes before glTF export.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Assets/softgoods.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'Assets/softgoods.glb'),export_format='GLB',export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
print('SOFTGOODS_COMPLETE',len(bpy.context.scene.objects))
