"""Create clean, lightweight cloth assets from the original room geometry."""
import bpy,bmesh,json,math,sys
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
source=json.loads((Path(args[0]) if args else ROOT/'previews/blender-scene.json').read_text())
roles={}
pillows=[]
for role in ['white','pattern','slate','curtain']:
 mat=bpy.data.materials.new(role);mat.diffuse_color=(.75,.72,.66,1);roles[role]=mat

def signed(value,power=.65):return math.copysign(abs(value)**power,value)
def point(matrix,p):
 w=matrix@Vector((*p,1));return (w.x,-w.z,w.y)

def pillow_point(x,y,z,dims,role,number):
 # A sewn, lightly stuffed shell: thin perimeter, full middle, soft ears and
 # a shallow top dent. Uneven edge gathers keep it from reading as a box.
 u,v=signed(x,.20),signed(y,.20)
 px,py=u*dims[0]/2,v*dims[1]/2
 py-=(.014 if role=='white' else .021)*math.exp(-(u/.32)**2)*max(v,0)**10
 edge=max(abs(u),abs(v));gather=math.exp(-((1-edge)/.18)**2)
 crease=(.0018*math.sin(u*34+v*8+number)+.0012*math.sin(v*41-u*11))*gather
 broad=.0025*math.sin(u*5+v*7+number)*max(0,1-u*u)*max(0,1-v*v)
 pz=signed(z,1.05)*dims[2]/2
 pz+=math.copysign(1,z)*(crease+broad)*abs(z)**.45 if abs(z)>1e-8 else 0
 return [px,py,pz]

def clear_mattress(vertex):
 # Exact rounded-box collision envelope in Blender's world coordinates.
 # The margin also covers cloth thickness and subdivision at the foot corner.
 center=Vector((62*.0254,-143*.0254,18*.0254));half=Vector((38*.0254,40*.0254,5*.0254));radius=2.5*.0254;margin=.005
 delta=vertex.co-center;q=Vector([abs(delta[k])-(half[k]-radius) for k in range(3)])
 outside=Vector([max(q[k],0) for k in range(3)]);distance=outside.length+min(max(q),0)-radius
 if distance<margin:
  if outside.length>1e-8:normal=Vector([math.copysign(outside[k],delta[k]) for k in range(3)]).normalized()
  else:
   axis=max(range(3),key=lambda k:q[k]);normal=Vector((0,0,0));normal[axis]=math.copysign(1,delta[axis])
  vertex.co+=normal*(margin-distance)
for number,data in enumerate(m for m in source['meshes'] if m['softgoods']):
 role=data['softgoods'];name=f"refined-{data['name']}-{number}"
 if data.get('dimensions'):
  dims=data['dimensions'];a=data['transform'];matrix=Matrix([a[i::4] for i in range(4)])
  bpy.ops.mesh.primitive_uv_sphere_add(segments=40,ring_count=24,radius=1)
  obj=bpy.context.object;obj.name=name;mesh=obj.data;local={};perimeter=[]
  for v in mesh.vertices:
   if abs(v.co.z)<.04:perimeter.append(v.index)
   p=pillow_point(*v.co,dims,role,number)
   local[v.index]=p;v.co=point(matrix,p)
  for loop in mesh.loops:
   p=local[loop.vertex_index];mesh.uv_layers.active.data[loop.index].uv=(p[0]/dims[0]+.5,p[1]/dims[1]+.5)
  pin=obj.vertex_groups.new(name='Sewn perimeter');pin.add(perimeter,1,'REPLACE')
  cloth=obj.modifiers.new('Relaxed pillow filling','CLOTH');settings=cloth.settings
  settings.quality=6;settings.mass=.1;settings.time_scale=.6;settings.tension_stiffness=15;settings.compression_stiffness=15;settings.shear_stiffness=6;settings.bending_stiffness=.3
  settings.use_pressure=True;settings.uniform_pressure_force=3;settings.vertex_group_mass=pin.name;settings.effector_weights.gravity=0
  cloth.collision_settings.use_collision=False;pillows.append(obj)
  curve=bpy.data.curves.new('Fine sewn pillow edge','CURVE');curve.dimensions='3D';curve.bevel_depth=.0009;curve.bevel_resolution=1
  spline=curve.splines.new('POLY');spline.points.add(95)
  for i,knot in enumerate(spline.points):
   t=i*math.tau/96;knot.co=(*point(matrix,pillow_point(math.cos(t),math.sin(t),0,dims,role,number)),1)
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
  if 'duvet' in data['name']:
   for vertex in obj.data.vertices:clear_mattress(vertex)
   obj.data.update()
 obj['materialRole']=role;obj.data.materials.append(roles[role])
 for poly in obj.data.polygons:poly.use_smooth=True
 obj.select_set(False)
# Relax the closed, pressure-filled cloth panels against their sewn perimeter.
# The fixed seam retains the shape and prevents balloon-like round corners.
for frame in range(1,36):bpy.context.scene.frame_set(frame)
for obj in pillows:
 bpy.context.view_layer.objects.active=obj;obj.select_set(True);bpy.ops.object.modifier_apply(modifier='Relaxed pillow filling');obj.select_set(False)
# Convert sewn curves to renderable meshes before glTF export.
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.convert(target='MESH')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Assets/softgoods.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'Assets/softgoods.glb'),export_format='GLB',export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
print('SOFTGOODS_COMPLETE',len(bpy.context.scene.objects))
