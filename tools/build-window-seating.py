"""Build the rounded leather reading chairs and matching timber table."""
import bpy,math
from pathlib import Path
from mathutils import Vector,Matrix
ROOT=Path(__file__).resolve().parents[1];I=.0254
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
materials={}
for name,color in [('leather',(.32,.13,.045,1)),('seam',(.25,.105,.045,1)),('wood',(.11,.065,.035,1)),('metal',(.015,.015,.015,1)),('pillow',(.6,.6,.55,1)),('pillow-seam',(.7,.66,.58,1))]:
    mat=bpy.data.materials.new(name);mat.diffuse_color=color;materials[name]=mat

def finish(obj,name,role,parent):
    obj.name=name;obj.parent=parent;obj['seatingRole']=role;obj.data.materials.append(materials[role])
    for p in obj.data.polygons:p.use_smooth=True
    return obj

def rounded_box(name,size,position,bevel,role,parent):
    bpy.ops.mesh.primitive_cube_add(size=1,location=tuple(v*I for v in position));obj=bpy.context.object
    obj.dimensions=tuple(v*I for v in size);bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    mod=obj.modifiers.new('Soft rounded edges','BEVEL');mod.width=bevel*I;mod.segments=5;bpy.ops.object.modifier_apply(modifier=mod.name)
    norm=obj.modifiers.new('Balanced surface normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=norm.name)
    return finish(obj,name,role,parent)

def pipe(name,points,radius,parent,role='seam'):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=radius*I;curve.bevel_resolution=2
    spline=curve.splines.new('NURBS');spline.points.add(len(points)-1)
    for knot,p in zip(spline.points,points):knot.co=(*(v*I for v in p),1)
    spline.order_u=3;spline.use_endpoint_u=True
    obj=bpy.data.objects.new(name,curve);bpy.context.collection.objects.link(obj);obj.parent=parent;obj['seatingRole']=role;curve.materials.append(materials[role]);return obj

chair=bpy.data.objects.new('Chair A',None);bpy.context.collection.objects.link(chair)
verts=[];faces=[];steps=88;limit=math.radians(126)
# Rounded upholstery cross-section, from the outside foot to the inner seat.
for i in range(steps+1):
    a=-limit+2*limit*i/steps;top=24+7*max(0,math.cos(a/limit*math.pi/2))**1.2
    profile=[(.94,6.5),(1,9),(1,17),(.995,top-2),(.97,top-.45),(.89,top),(.81,top-.5),(.77,top-2),(.77,18),(.77,14.5),(.84,12),(.94,6.5)]
    for radius,z in profile:
        gather=.055*math.sin(a*24+z*.8)*math.exp(-((z-18)/3)**2) if radius<.82 else 0
        verts.append((15*radius*math.sin(a)*I,(14.5*radius*math.cos(a)+gather)*I,z*I))
n=len(profile)
for i in range(steps):
    for k in range(n-1):faces.append((i*n+k,(i+1)*n+k,(i+1)*n+k+1,i*n+k+1))
for end,sign in [(0,-1),(steps,1)]:
    ring=list(range(end*n,end*n+n-1));center=sum((Vector(verts[j]) for j in ring),Vector())/len(ring);center.x+=sign*.16*I
    index=len(verts);verts.append(tuple(center))
    for k in range(len(ring)):faces.append((ring[k],ring[(k+1)%len(ring)],index) if end else (ring[(k+1)%len(ring)],ring[k],index))
mesh=bpy.data.meshes.new('Continuous upholstered barrel');mesh.from_pydata(verts,[],faces);mesh.update();obj=bpy.data.objects.new('Wraparound leather back and arms',mesh);bpy.context.collection.objects.link(obj)
bpy.context.view_layer.objects.active=obj;obj.select_set(True)
bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
sub=obj.modifiers.new('Cushioned barrel surface','SUBSURF');sub.levels=2;bpy.ops.object.modifier_apply(modifier=sub.name)
finish(obj,'Wraparound leather back and arms','leather',chair)
for name,dimensions,center,power in [('Single upholstered seat',(26.5,26,8.5),(0,-.7,14),.35)]:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=56,ring_count=28,radius=1);obj=bpy.context.object
    for v in obj.data.vertices:
        s=v.co.copy();v.co=Vector([math.copysign(abs(s[k])**(power if k<2 else .6),s[k])*dimensions[k]/2*I+center[k]*I for k in range(3)])
        if name.startswith('Loose'):v.co.z+=.055*I*math.sin(v.co.x/I*2.2)*math.exp(-((abs(v.co.y/I+1.3)-10)/2)**2)
    finish(obj,name,'leather',chair)
points=[]
for j in range(97):
    a=j/96*math.tau;x=math.copysign(abs(math.cos(a))**.35,math.cos(a))*13.25;y=math.copysign(abs(math.sin(a))**.35,math.sin(a))*13-.7;points.append((x,y,13.9))
pipe('Seat cushion welt',points,.035,chair)
points=[]
for j in range(89):
    a=-limit+2*limit*j/88;top=24+7*max(0,math.cos(a/limit*math.pi/2))**1.2;points.append((15*.81*math.sin(a),14.5*.81*math.cos(a),top-.5))
pipe('Inner back stitched seam',points,.025,chair)
bpy.ops.mesh.primitive_uv_sphere_add(segments=48,ring_count=28,radius=1);obj=bpy.context.object
for v in obj.data.vertices:
    s=v.co.copy();x=math.copysign(abs(s.x)**.2,s.x)*8.5;z=math.copysign(abs(s.z)**.2,s.z)*8.5
    z-=.55*math.exp(-(x/2.2)**2)*max(z/8.5,0)**10
    y=math.copysign(abs(s.y)**1.05,s.y)*2.25;v.co=(x*I,y*I,z*I)
obj.location=(0,5.5*I,25.5*I);obj.rotation_euler.x=-.28;finish(obj,'Cream and slate houndstooth cushion','pillow',chair)
points=[];lean=Matrix.Rotation(-.28,3,'X')
for j in range(97):
    a=j/96*math.tau;x=math.copysign(abs(math.cos(a))**.2,math.cos(a))*8.5;z=math.copysign(abs(math.sin(a))**.2,math.sin(a))*8.5
    z-=.55*math.exp(-(x/2.2)**2)*max(z/8.5,0)**10;p=lean@Vector((x,0,z));points.append((p.x,p.y+5.5,p.z+25.5))
pipe('Cushion sewn edge',points,.03,chair,'pillow-seam')
for x in [-9,9]:
    for y in [-8.5,8.5]:
        bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.85*I,radius2=1.25*I,depth=10*I,location=(x*I,y*I,5*I));finish(bpy.context.object,'Tapered timber leg','wood',chair)
# Convert the two sewn edges; create useful planar upholstery/wood UVs.
bpy.ops.object.select_all(action='DESELECT')
for obj in list(chair.children):
    if obj.type=='CURVE':obj.select_set(True);bpy.context.view_layer.objects.active=obj;bpy.ops.object.convert(target='MESH');obj.select_set(False)
for obj in chair.children:
    if obj.type!='MESH':continue
    uv=obj.data.uv_layers.new(name='SurfaceUV') if not obj.data.uv_layers else obj.data.uv_layers.active
    for loop in obj.data.loops:
        co=obj.data.vertices[loop.vertex_index].co;uv.data[loop.index].uv=(co.x/(17*I)+.5,co.z/(17*I)+.5) if obj['seatingRole']=='pillow' else (co.x/.4,co.z/.4+co.y/.4)
chair.location=(28*I,-29*I,0);chair.rotation_euler.z=math.radians(20)
second=bpy.data.objects.new('Chair B',None);bpy.context.collection.objects.link(second);second.location=(88*I,-29*I,0);second.rotation_euler.z=math.radians(-20)
for original in list(chair.children):
    copy=original.copy();copy.data=original.data;copy.parent=second;bpy.context.collection.objects.link(copy)
table=bpy.data.objects.new('Matching wood side table',None);bpy.context.collection.objects.link(table);table.location=(58*I,-32*I,0)
for name,radius,depth,z,role in [('Round timber tabletop',9,1.25,21,'wood'),('Black metal pedestal',1.15,20,10.5,'metal'),('Circular black metal base',7,.65,.325,'metal')]:
    bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=radius*I,depth=depth*I,location=(0,0,z*I));obj=bpy.context.object
    mod=obj.modifiers.new('Soft finished edges','BEVEL');mod.width=(.12 if role=='wood' else .08)*I;mod.segments=3;bpy.ops.object.modifier_apply(modifier=mod.name);finish(obj,name,role,table)
bpy.ops.object.select_all(action='SELECT');bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'Assets/window-seating.blend'))
bpy.ops.export_scene.gltf(filepath=str(ROOT/'Assets/window-seating.glb'),export_format='GLB',export_extras=True,export_yup=True,export_cameras=False,export_lights=False)
print('WINDOW_SEATING_COMPLETE',len(bpy.context.scene.objects),flush=True)
