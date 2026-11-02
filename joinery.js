import * as THREE from './vendor/three.module.js';
const I=.0254;

// Extruded trim profiles with real angled ends, rather than overlapping boxes.
export function planPrism(points,height,centerY,material,parent,name='mitered-trim'){
  const shape=new THREE.Shape(points.map(([x,z])=>new THREE.Vector2(x*I,-z*I)));
  const geometry=new THREE.ExtrudeGeometry(shape,{depth:height*I,bevelEnabled:false});geometry.rotateX(-Math.PI/2);geometry.translate(0,(centerY-height/2)*I,0);
  const p=geometry.attributes.position,n=geometry.attributes.normal,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    if(Math.abs(n.getY(i))>.5)uv.setXY(i,p.getX(i)/(48*I),p.getZ(i)/(24*I));
    else if(Math.abs(n.getX(i))>.5)uv.setXY(i,p.getZ(i)/(48*I),p.getY(i)/(24*I));
    else uv.setXY(i,p.getX(i)/(48*I),p.getY(i)/(24*I));
  }
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.castShadow=mesh.receiveShadow=true;mesh.userData.mitered=true;parent.add(mesh);return mesh;
}

export function miteredRail(length,height,depth,x,y,z,material,parent,start=0,end=0){
  const a=x-length/2,b=x+length/2,near=z-depth/2,far=z+depth/2;
  return planPrism([[a+start*near,near],[b+end*near,near],[b+end*far,far],[a+start*far,far]],height,y,material,parent);
}

// Four individually cut members. Equal-width borders meet along 45-degree
// diagonals; layered bands create a traditional molded frame profile.
export function miteredFrameBand(width,height,border,depth,x,y,z,material,parent,parts=['top','bottom','left','right']){
  const a=width/2,b=height/2,c=a-border,d=b-border;
  const polygons={top:[[-a,b],[a,b],[c,d],[-c,d]],bottom:[[-a,-b],[-c,-d],[c,-d],[a,-b]],left:[[-a,-b],[-a,b],[-c,d],[-c,-d]],right:[[a,-b],[c,-d],[c,d],[a,b]]};
  const group=new THREE.Group();group.name='mitered-picture-frame';group.position.set(x*I,y*I,z*I);parent.add(group);
  for(const part of parts){const shape=new THREE.Shape(polygons[part].map(([px,py])=>new THREE.Vector2(px*I,py*I)));const geo=new THREE.ExtrudeGeometry(shape,{depth:depth*I,bevelEnabled:false});geo.translate(0,0,-depth*I/2);const mesh=new THREE.Mesh(geo,material);mesh.castShadow=mesh.receiveShadow=true;mesh.userData.mitered=true;group.add(mesh);}
  return group;
}

export function addBlackFrame(width,height,border,x,y,z,material,parent){
  const trim=border*.16,body=border*.64,inner=border-trim-body;
  const group=new THREE.Group();group.name='wide-black-mitered-frame';parent.add(group);
  miteredFrameBand(width,height,trim,1.8,x,y,z,material,group);
  miteredFrameBand(width-2*trim,height-2*trim,body,1.25,x,y,z+.05,material,group);
  miteredFrameBand(width-2*(trim+body),height-2*(trim+body),inner,1.65,x,y,z-.08,material,group);
  return group;
}
