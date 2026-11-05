import * as THREE from './vendor/three.module.js';
import { createInspiredDesign } from './designs.js?v=20261103-rail-photo';
import { createVaultedCeiling } from './vaulted.js?v=20261103-day-restore';
import { createWindowReflections } from './glass.js?v=20261103-quality';
import { createPhotoMaterials, createPhotoFloor } from './photo-materials.js?v=20261103-chair-back';
import { createAntiqueFurniture } from './antique-furniture.js';
import { miteredRail, miteredFrameBand } from './joinery.js';
import { createPhotoExterior } from './exterior.js?v=20261103-day-restore';
import { installRefinedSoftgoods, installBakedLighting, followWallLighting } from './quality.js?v=20261103-curtain-rings';
import { installWindowSeating, installSeatingLighting } from './seating.js?v=20261103-chair-back';
import { createOfficeRoom } from './office.js?v=20261105-office';
import { createHousePlan } from './house-plan.js?v=20261105-office';

// Sketch coordinates: X runs left to right, Z runs top to bottom. Dimensions in inches.
const INCH = 0.0254;
const ROOM = { width:169, depth:187, height:96, notchX:124, notchZ:120 };
const viewport = document.querySelector('#viewport');
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.025, 220);
const renderer = new THREE.WebGLRenderer({ antialias:true, powerPreference:'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = .95;
renderer.outputColorSpace = THREE.SRGBColorSpace;
viewport.appendChild(renderer.domElement);
const reflections=createWindowReflections(scene,renderer);
const photoMaterials=createPhotoMaterials();
const $ = id => document.getElementById(id);
const m = (color, roughness=.75, extra={}) => new THREE.MeshStandardMaterial({color,roughness,...extra});
const paint=m('#8fa7b7'), trim=m('#efeee3',.5), ceilingMat=m('#f3f0e5'), dark=m('#302a26',.5);
const metal=m('#696b64',.3,{metalness:.8}), black=m('#222622',.55), ivory=m('#e9e3cf',.8);
const navy=m('#253e6c',.95), paleBlue=m('#8da5af',.95), sheet=m('#e1e1d7',1);
const furniture = new THREE.Group(); scene.add(furniture);
const colliders=[];
function collider(x,z,w,d){colliders.push({x:x*INCH,z:z*INCH,w:w*INCH/2,d:d*INCH/2});}
function box(w,h,d,x,y,z,mat,parent=scene,rounded=0){
  let geo=new THREE.BoxGeometry(w*INCH,h*INCH,d*INCH,rounded?4:1,rounded?4:1,rounded?4:1);
  if(rounded){
    const p=geo.attributes.position, v=new THREE.Vector3(), c=new THREE.Vector3();
    const r=Math.min(rounded,w/2,h/2,d/2)*INCH;
    for(let i=0;i<p.count;i++){
      v.fromBufferAttribute(p,i); c.set(THREE.MathUtils.clamp(v.x,-w*INCH/2+r,w*INCH/2-r),THREE.MathUtils.clamp(v.y,-h*INCH/2+r,h*INCH/2-r),THREE.MathUtils.clamp(v.z,-d*INCH/2+r,d*INCH/2-r));
      v.sub(c).normalize().multiplyScalar(r).add(c);p.setXYZ(i,v.x,v.y,v.z);
    }geo.computeVertexNormals();
  }
  const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x*INCH,y*INCH,z*INCH);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(rx,ry,rz,x,y,z,mat,parent=scene){const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,24,16),mat);mesh.scale.set(rx*INCH,ry*INCH,rz*INCH);mesh.position.set(x*INCH,y*INCH,z*INCH);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function cylinder(rt,rb,h,x,y,z,mat,parent=scene){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt*INCH,rb*INCH,h*INCH,24),mat);mesh.position.set(x*INCH,y*INCH,z*INCH);mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh;}
function rod(a,b,r,mat,parent=scene){const av=new THREE.Vector3(...a).multiplyScalar(INCH),bv=new THREE.Vector3(...b).multiplyScalar(INCH);const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r*INCH,r*INCH,av.distanceTo(bv),10),mat);mesh.position.copy(av).add(bv).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bv.sub(av).normalize());parent.add(mesh);return mesh;}
let seed=1729;function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}
function woodTexture(base){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=512;const c=canvas.getContext('2d');c.fillStyle=base;c.fillRect(0,0,128,512);
  for(let i=0;i<220;i++){const x=random()*128;c.strokeStyle=`rgba(${random()>.5?'55,30,13':'255,237,195'},${random()*.17})`;c.lineWidth=random()*1.2+.2;c.beginPath();c.moveTo(x,0);c.bezierCurveTo(x+random()*9,170,x-random()*10,340,x+random()*4,512);c.stroke();}
  const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;tex.anisotropy=8;return tex;
}
const oakMats=['#a78253','#b69565','#c3a475','#b18b58','#bea273','#ac8b63','#c6ae82'].map(c=>m('#ffffff',.62,{map:woodTexture(c)}));
const walnut=m('#69503a',.55,{map:woodTexture('#a18c73')});
const espresso=m('#4e362a',.5,{map:woodTexture('#8a7663')});

// Actual L-shaped floor and ceiling, with the southeast hallway notch removed.
const outline=[[0,0],[169,0],[169,120],[124,120],[124,187],[0,187]];
const shape=new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x*INCH,-z*INCH)));
const legacyFloor=new THREE.Group();legacyFloor.visible=false;scene.add(legacyFloor);
const floorBase=new THREE.Mesh(new THREE.ShapeGeometry(shape),oakMats[0]);floorBase.rotation.x=-Math.PI/2;floorBase.receiveShadow=true;legacyFloor.add(floorBase);
const photoFloor=createPhotoFloor(scene,photoMaterials.floor);
const ceiling=new THREE.Mesh(new THREE.ShapeGeometry(shape),ceilingMat);ceiling.rotation.x=Math.PI/2;ceiling.scale.y=-1;ceiling.position.y=96*INCH;ceiling.receiveShadow=true;scene.add(ceiling);
// Individual staggered oak boards, with no flooring leaking into the notch.
for(let x=0;x<169;x+=3.25){const maxZ=x>=124?120:187;const width=Math.min(3.25,169-x);let z=0,first=12+random()*30;while(z<maxZ){const length=Math.min(z===0?first:25+random()*27,maxZ-z);box(width-.025,.32,length-.045,x+width/2,-.17,z+length/2,oakMats[Math.floor(random()*oakMats.length)],legacyFloor);z+=length;}}

// Wall segments are built around real openings rather than covering them with images.
const wallCrowns=[];
function wall(length,x,z,rotation,openings=[],corners={start:1,end:-1}){
  const g=new THREE.Group();g.position.set(x*INCH,0,z*INCH);g.rotation.y=rotation;scene.add(g);
  const cuts=[0,length,...openings.flatMap(o=>[o.start,o.start+o.width])].sort((a,b)=>a-b);
  for(let i=0;i<cuts.length-1;i++){const a=cuts[i],b=cuts[i+1];if(b-a<.01)continue;const opening=openings.find(o=>(a+b)/2>o.start&&(a+b)/2<o.start+o.width);
    if(!opening)box(b-a,96,4,(a+b)/2,48,-2,paint,g);
    else{if(opening.sill)box(b-a,opening.sill,4,(a+b)/2,opening.sill/2,-2,paint,g);const top=opening.sill+opening.height;box(b-a,96-top,4,(a+b)/2,(96+top)/2,-2,paint,g);}
    if(!opening||opening.sill){const start=a===0?corners.start:0,end=b===length?corners.end:0;miteredRail(b-a,5,.7,(a+b)/2,2.5,.4,trim,g,start,end);miteredRail(b-a,.65,1.05,(a+b)/2,5.05,.45,trim,g,start,end);miteredRail(b-a,.6,1.15,(a+b)/2,.4,.55,trim,g,start,end);}
  }
  // Three stepped runs approximate the painted crown molding in the photos.
  const crown=[miteredRail(length,2.6,.8,length/2,93.2,.4,trim,g,corners.start,corners.end),miteredRail(length,1.2,1.7,length/2,94.6,.85,trim,g,corners.start,corners.end),miteredRail(length,.7,2.4,length/2,95.55,1.2,trim,g,corners.start,corners.end)];wallCrowns.push({group:g,meshes:crown});
  for(const o of openings)miteredFrameBand(o.width+5.4,o.height+5.4,2.7,1,o.start+o.width/2,o.sill+o.height/2,.55,trim,g,o.sill?['top','bottom','left','right']:['top','left','right']);
  return g;
}
const north=wall(169,0,0,0,[{start:25,width:34,sill:28,height:56}]);
const west=wall(187,0,187,Math.PI/2,[{start:128,width:34,sill:28,height:56}]);
wall(120,169,0,-Math.PI/2,[{start:25,width:24,sill:0,height:80}]);
const south=wall(124,124,187,Math.PI);
wall(67,124,120,-Math.PI/2,[],{start:-1,end:-1});
const entryWall=wall(45,169,120,Math.PI,[{start:0,width:30,sill:0,height:80}],{start:1,end:1});
const centeredEntryWall=wall(45,169,120,Math.PI,[{start:7.5,width:30,sill:0,height:80}],{start:1,end:1});
centeredEntryWall.name='centered-entry-wall';centeredEntryWall.userData.doorMargins=[7.5,7.5];centeredEntryWall.visible=false;

const windowGlazing=[],windowGlows=[],shutters=[];
// Soft rectangular radiance gives the impression of exposure bloom without
// applying a blur to the furniture, trim, or the rest of the room.
const glowCanvas=document.createElement('canvas');glowCanvas.width=256;glowCanvas.height=512;
const glowContext=glowCanvas.getContext('2d');
glowContext.filter='blur(27px)';glowContext.fillStyle='#fff8e6';
glowContext.fillRect(49,66,158,380);
const glowTexture=new THREE.CanvasTexture(glowCanvas);glowTexture.colorSpace=THREE.SRGBColorSpace;
function windowModel(g,center,sharedSill=false){
  const frameWood=m('#8b6c47',.6);
  if(!sharedSill){box(36,1.6,4,center,27.4,1.5,trim,g);box(39,1,5,center,26.4,1.7,trim,g);}
  box(1.1,56,2,center-16.5,56,-1,frameWood,g);box(1.1,56,2,center+16.5,56,-1,frameWood,g);
  box(34,1.2,2,center,28.6,-1,frameWood,g);box(34,1.2,2,center,83.4,-1,frameWood,g);
  box(32,1.5,1.5,center,56,.1,frameWood,g);
  const glass=new THREE.MeshBasicMaterial({color:'#fffbed',transparent:true,opacity:.97,depthWrite:false,toneMapped:false});
  windowGlazing.push(glass);
  const pane=box(31.5,53.5,.12,center,56,-.6,glass,g);pane.castShadow=false;pane.name='window-glazing';
  reflections.addPane(g,31.5,53.5,center,56,-.45);
  const glowMaterial=new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,opacity:.24,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(57*INCH,84*INCH),glowMaterial);
  glow.position.set(center*INCH,56*INCH,1.9*INCH);glow.renderOrder=2;g.add(glow);windowGlows.push(glowMaterial);
  // Clear glass without decorative pane grids; retain the sash lock.
  box(1.4,.65,1.2,center,57,1,metal,g);
  const shutterGroup=new THREE.Group();g.add(shutterGroup);shutters.push(shutterGroup);
  shutterGroup.userData.westWindow=g===west;
  for(const side of [-1,1]){
    const sx=center+side*20.7;
    box(6.8,54,.9,sx,56,1.5,trim,shutterGroup);
    for(const y of [30,56,82])box(7.1,1.3,1.4,sx,y,2.15,trim,shutterGroup);
    for(const dx of [-3,3])box(.8,53,1.5,sx+dx,56,2.1,trim,shutterGroup);
    for(let y=32;y<81;y+=1.35){if(Math.abs(y-56)<1.7)continue;const l=box(5.4,.65,1.1,sx,y,2.7,trim,shutterGroup);l.rotation.x=-.38;}
  }
}
windowModel(north,42);windowModel(west,145);
// Closed, full-width plantation shutters on the single west-wall window.
const closedWestShutters=new THREE.Group();closedWestShutters.name='closed-west-plantation-shutters';closedWestShutters.visible=false;west.add(closedWestShutters);
const shutterRecess=m('#b8b9ad',.85);
for(let i=0;i<4;i++){
  const x=128+8.5*(i+.5);
  box(8.4,55,.25,x,56,1.2,shutterRecess,closedWestShutters);
  for(const dx of [-3.8,3.8])box(.8,55,.85,x+dx,56,1.7,trim,closedWestShutters);
  for(const y of [29.3,56,82.7])box(8.4,1.5,.9,x,y,1.7,trim,closedWestShutters);
  for(const [bottom,top] of [[31,54.5],[58,81]]){
    for(let y=bottom;y<=top;y+=1.2){const slat=box(6.9,1.2,.55,x,y,1.9,trim,closedWestShutters);slat.rotation.x=.6;}
    box(.2,top-bottom+.7,.25,x,(bottom+top)/2,2.8,trim,closedWestShutters);
  }
}
box(.7,2,.45,145,55.5,2.6,metal,closedWestShutters);
// Design alternatives use one properly opened/cased wall for the paired unit.
const doubleNorth=wall(169,0,0,0,[{start:25,width:71,sill:28,height:56}]);
doubleNorth.name='paired-window-wall';doubleNorth.userData.openingWidth=71;doubleNorth.visible=false;
windowModel(doubleNorth,42,true);windowModel(doubleNorth,79,true);
box(73,1.6,4,60.5,27.4,1.5,trim,doubleNorth);
box(76,1,5,60.5,26.4,1.7,trim,doubleNorth);
box(3,56,2,60.5,56,.1,trim,doubleNorth);
// White hydronic baseboard heating under the windows.
function heater(w,x,z,rot){const g=new THREE.Group();g.position.set(x*INCH,0,z*INCH);g.rotation.y=rot;scene.add(g);box(w,6,2.5,0,3.7,0,trim,g);box(w,1,3,0,7,.1,trim,g);box(w-2,.5,.15,0,5.1,1.35,m('#858a7e'),g);}
heater(112,60,2.3,0);heater(94,2.3,53,Math.PI/2);

// Hallway and walk-in closet are shallow context models beyond the two doors.
box(45,.4,67,146.5,-.2,153.5,oakMats[1]);box(4,96,67,171,48,153.5,m('#d3c7a8'));
box(45,96,4,146.5,48,189,m('#d3c7a8'));box(41,2,63,148.5,97,155.5,ceilingMat);
box(38,.5,56,190,-.2,37,oakMats[0]);box(4,96,56,210,48,37,ivory);box(38,96,4,190,48,7,ivory);box(38,96,4,190,48,66,ivory);box(38,2,56,190,97,37,ceilingMat);
for(const y of [18,36,54,72])box(28,1,10,191,y,60,trim);
const doorInsets=[];
function door(width,x,z,rotation,angle){const hinge=new THREE.Group();hinge.position.set(x*INCH,0,z*INCH);hinge.rotation.y=rotation+angle;scene.add(hinge);box(width,80,1.4,width/2,40,0,trim,hinge);const inset=m('#d9dbd0',.55);doorInsets.push(inset);
  for(const dx of [width*.26,width*.74])for(const [y,h] of [[14,20],[41,27],[67,15]]){
    box(width*.36,h,.18,dx,y,.76,inset,hinge);box(width*.36-1,h-1,.15,dx,y,.9,trim,hinge);
    box(width*.36,h,.18,dx,y,-.76,inset,hinge);box(width*.36-1,h-1,.15,dx,y,-.9,trim,hinge);
  }
  sphere(1,1,1,width-3,36,1.5,metal,hinge);sphere(1,1,1,width-3,36,-1.5,metal,hinge);return hinge;
}
const originalEntryDoor=door(30,169,120,Math.PI,0);
const centeredEntryDoor=door(30,161.5,120,Math.PI,0);centeredEntryDoor.name='centered-hallway-door';centeredEntryDoor.visible=false;
door(24,169,49,Math.PI/2,0);

// King bed with timber frame, shaped bedding, pillows, and quilt stitching.
const bx=62, bz=143;
box(80,9,84,bx,10,bz,espresso,furniture,1.2);box(80,37,2.3,bx,22,185,espresso,furniture,1);
for(const x of [bx-35,bx+35])for(const z of [106,180])box(3,9,3,x,4.5,z,espresso,furniture);
box(76,10,80,bx,18,bz,sheet,furniture,3);
box(77,2.8,66,bx,24,136,navy,furniture,1.3);
// A softly rippled quilt surface, with gravity draping it over both sides and foot.
const qGeo=new THREE.PlaneGeometry(83*INCH,69*INCH,72,64);qGeo.rotateX(-Math.PI/2);
const qp=qGeo.attributes.position;
for(let i=0;i<qp.count;i++){
  const x=qp.getX(i)/INCH,z=qp.getZ(i)/INCH;
  const drop=Math.max(0,Math.abs(x)-36)*1.4+Math.max(0,-z-29)*1.6;
  const ripple=(Math.sin(x*.55+z*.21)*.35+Math.sin(z*.66-x*.17)*.25)*(.5+Math.abs(x)/40);
  qp.setY(i,(26-drop+ripple)*INCH);
}qGeo.computeVertexNormals();const quilt=new THREE.Mesh(qGeo,navy);quilt.position.set(bx*INCH,0,136*INCH);quilt.castShadow=true;quilt.receiveShadow=true;furniture.add(quilt);
const stitchMat=new THREE.LineBasicMaterial({color:'#5a6e91',transparent:true,opacity:.45});
for(let z=-26;z<30;z+=7){const pts=[];for(let x=-36;x<=36;x+=1.5){const y=26.13+(Math.sin(x*.55+z*.21)*.35+Math.sin(z*.66-x*.17)*.25)*(.5+Math.abs(x)/40);pts.push(new THREE.Vector3((x+bx)*INCH,y*INCH,(z+136)*INCH));}const line=new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),stitchMat);furniture.add(line);}
box(76,2.2,9,bx,26.8,167,paleBlue,furniture,1);
for(const x of [bx-19,bx+19]){const p=box(33,6,18,x,28,174,sheet,furniture,2.9);p.rotation.x=.14;p.rotation.z=x<bx?-.05:.04;}
collider(bx,bz,82,86);

const lamps=[];
function lamp(x,z){cylinder(3,3,.65,x,27,z,metal,furniture);rod([x,27,z],[x,44,z],.3,metal,furniture);rod([x,44,z],[x+5,44,z],.3,metal,furniture);const shade=cylinder(1.4,1.7,4,x+5,42.6,z,metal,furniture);const bulb=m('#fff1c3',.2,{emissive:'#ffdc88',emissiveIntensity:1.8});sphere(1.25,.35,1.25,x+5,40.5,z,bulb,furniture);const light=new THREE.PointLight('#ffda9e',9,1.6,2);light.position.set((x+5)*INCH,39*INCH,z*INCH);scene.add(light);lamps.push(light);}
function bedside(x){box(17,1.3,17,x,25.5,176,walnut,furniture);for(const dx of [-7,7])for(const dz of [-7,7])box(1.3,24,1.3,x+dx,12,176+dz,dark,furniture);box(15,1,15,x,5,176,espresso,furniture);lamp(x,176);collider(x,176,18,18);}
bedside(12);bedside(111);

// The photo-matched antique chest is shared by every design.
collider(62,91,49,20);

// Cream painted desk, 41 × 21 inches, facing the top wall.
const dx=91,dz=12;
box(43,1.6,23,dx,30,dz,trim,furniture,.5);
for(const side of [-1,1]){
  const x=dx+side*15.2;box(10,25,20,x,15.5,dz,ivory,furniture,.3);
  for(let i=0;i<4;i++){box(9.5,5.3,.75,x,6.7+i*5.8,dz+10.35,trim,furniture,.25);sphere(.65,.65,.55,x,7+i*5.8,dz+11,black,furniture);}
  for(const z of [dz-8,dz+8])box(2.3,4,2.3,x,2,z,trim,furniture);
}
box(20,3,1,dx,27.5,dz+10,ivory,furniture);
box(20,12,1.1,dx,43,dz-5,black,furniture,.5);
const screen=m('#182c34',.35,{emissive:'#183e50',emissiveIntensity:.2});box(18.7,10.6,.12,dx,43,dz-4.35,screen,furniture);
rod([dx,31,dz-5],[dx,37,dz-5],.7,metal,furniture);cylinder(4,4,.5,dx,31,dz-5,black,furniture);
box(14,.5,4.3,dx,31.2,dz+5,ivory,furniture,.2);for(let i=0;i<4;i++)box(12,.08,.08,dx,31.5,dz+3.6+i*.8,m('#a5aaa0'),furniture);
// Molded blue chair with splayed timber legs.
const cx=91,cz=36;box(17,2,16,cx,18,cz,paleBlue,furniture,1);const back=box(17,16,2,cx,26,cz+7,paleBlue,furniture,1);back.rotation.x=-.12;
for(const sx of [-1,1])for(const sz of [-1,1])rod([cx+sx*5,17,cz+sz*5],[cx+sx*8,0,cz+sz*8],.7,walnut,furniture);
collider(dx,dz,43,23);collider(cx,cz,18,18);

// The actual dresser stays in the same measured zone in every design.
const dresserZ=72;
collider(158.5,dresserZ,21,35);

// Small cream table below the west window.
box(20,1.5,16,11,28,42,trim,furniture,.4);box(18,6,14,11,24,42,ivory,furniture);box(.8,1,.5,20.5,24,42,black,furniture);
for(const x of [3,19])for(const z of [36,48])box(1.5,24,1.5,x,12,z,trim,furniture);box(18,1,14,11,5,42,trim,furniture);collider(11,42,20,16);

function plant(x,z,size=1){const pot=m('#b9b6a6'),leaf=m('#3d6645',.8);cylinder(4*size,3*size,7*size,x,3.5*size,z,pot,furniture);for(let i=0;i<9;i++){const a=i*2.4,tx=x+Math.cos(a)*7*size,tz=z+Math.sin(a)*7*size,y=(10+random()*13)*size;rod([x,5*size,z],[tx,y,tz],.16*size,leaf,furniture);const l=sphere(3*size,.35*size,5*size,tx,y,tz,leaf,furniture);l.rotation.y=-a;l.rotation.z=Math.sin(a)*.4;}}
plant(12,12,1.25);plant(108,12,.42);
// White sockets and switch plates add scale to the blue walls.
for(const [x,z,rot,y] of [[32,.8,0,13],[.8,115,Math.PI/2,13],[122.9,157,-Math.PI/2,43],[.8,171,Math.PI/2,13]]){const g=new THREE.Group();g.position.set(x*INCH,0,z*INCH);g.rotation.y=rot;scene.add(g);box(2.8,4.5,.3,0,y,0,trim,g,.15);for(const sy of [-.7,.7])box(.6,.2,.1,0,y+sy,.2,dark,g);}

// Dark five-blade ceiling fan, frosted bowl light and two pull chains.
const fanGroup=new THREE.Group();fanGroup.position.set(72*INCH,0,92*INCH);scene.add(fanGroup);
cylinder(4,3,2,0,95,0,dark,fanGroup);cylinder(.6,.6,7,0,90,0,metal,fanGroup);sphere(5,4,5,0,85,0,dark,fanGroup);
const rotor=new THREE.Group();rotor.position.y=85*INCH;fanGroup.add(rotor);
for(let i=0;i<5;i++){const blade=box(20,.55,4.6,14,0,0,espresso,rotor,1.2);const pivot=new THREE.Group();rotor.add(pivot);pivot.rotation.y=i*Math.PI*2/5;pivot.add(blade);blade.rotation.z=.09;}
const globeMat=m('#f6efd7',.3,{emissive:'#ffe4ad',emissiveIntensity:.3});sphere(6,2.8,6,0,80.5,0,globeMat,fanGroup);cylinder(1,1,.7,0,77.7,0,dark,fanGroup);
rod([2,80,1],[2,66,1],.07,metal,fanGroup);rod([-2,81,1],[-2,69,1],.07,metal,fanGroup);sphere(.4,1,.4,2,65,1,dark,fanGroup);sphere(.35,.7,.35,-2,68,1,dark,fanGroup);
const fanLight=new THREE.PointLight('#ffdfad',15,7,2);fanLight.position.set(72*INCH,77*INCH,92*INCH);scene.add(fanLight);

// A six-face skybox with a gentle sky gradient and procedural clouds.
function skyFace(face){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const c=canvas.getContext('2d');const grad=c.createLinearGradient(0,0,0,512);if(face===2){grad.addColorStop(0,'#81b0d1');grad.addColorStop(1,'#97bed5');}else if(face===3){grad.addColorStop(0,'#92a17d');grad.addColorStop(1,'#869577');}else{grad.addColorStop(0,'#91b8d2');grad.addColorStop(.53,'#d4e0df');grad.addColorStop(.55,'#aebba1');grad.addColorStop(1,'#8b9b76');}c.fillStyle=grad;c.fillRect(0,0,512,512);if(face!==3){for(let i=0;i<20;i++){const x=random()*512,y=random()*(face===2?512:230),r=15+random()*45;const cloud=c.createRadialGradient(x,y,0,x,y,r);cloud.addColorStop(0,'#ffffff50');cloud.addColorStop(1,'#ffffff00');c.fillStyle=cloud;c.fillRect(x-r,y-r,r*2,r*2);}}return canvas;}
const skybox=new THREE.CubeTexture(Array.from({length:6},(_,i)=>skyFace(i)));skybox.colorSpace=THREE.SRGBColorSpace;skybox.needsUpdate=true;scene.background=skybox;
const [exterior,nightExterior]=await Promise.all([createPhotoExterior(scene),createPhotoExterior(scene,{night:true})]);
const hemi=new THREE.HemisphereLight('#d3e7f5','#99856e',1.3);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff1d2',2.1);sun.position.set(-6,9,-7);sun.target.position.set(1,0,2);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5,near:.1,far:24});sun.shadow.bias=-.0004;sun.shadow.normalBias=.02;sun.shadow.radius=3;
// Broad, shadowless fill approximates bounced daylight from both windows.
const windowLights=[];for(const pos of [[42,65,6],[6,65,42],[79,65,6]]){const light=new THREE.PointLight('#e2f0ff',8,7,2);light.position.set(...pos.map(v=>v*INCH));scene.add(light);windowLights.push(light);}
const hallLight=new THREE.PointLight('#ffd28d',18,4,2);hallLight.position.set(151*INCH,70*INCH,142*INCH);scene.add(hallLight);

// Optional dimension lines, positioned inside the room for an interior camera.
const measurements=new THREE.Group();measurements.visible=false;scene.add(measurements);
function label(text,x,y,z){const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#f6f5e9';ctx.beginPath();ctx.roundRect(4,4,504,120,22);ctx.fill();ctx.font='500 42px Segoe UI';ctx.fillStyle='#33594a';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,64);const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,depthTest:false}));sprite.scale.set(.8,.2,1);sprite.position.set(x*INCH,y*INCH,z*INCH);measurements.add(sprite);}
function dimension(a,b,text){rod(a,b,.1,m('#557d68',.5,{emissive:'#557d68',emissiveIntensity:.3}),measurements);for(const p of [a,b])sphere(.5,.5,.5,...p,m('#557d68'),measurements);label(text,(a[0]+b[0])/2,(a[1]+b[1])/2+4,(a[2]+b[2])/2);}
dimension([3,89,9],[166,89,9],'169″ · 14′ 1″');dimension([9,89,3],[9,89,184],'187″ · 15′ 7″');dimension([119,2,126],[119,94,126],'96″ · 8′ ceiling');dimension([126,9,116],[167,9,116],'45″ notch');label('King · 76 × 80″',62,38,140);label('Desk · 41 × 21″',91,50,14);label('Chest · 48 × 19″',62,30,91);

// First-person navigation: drag to look, keyboard/touch to walk, and footprint/furniture collision.
const originalColliders=colliders.slice();
const antiqueFurniture=createAntiqueFurniture({scene,INCH,box,rod,cylinder,m,materials:photoMaterials});
const inspired=createInspiredDesign({scene,INCH,box,sphere,cylinder,rod,m,photoMaterials});
await inspired.ready;
const refinedSoftgoods=await installRefinedSoftgoods(inspired);
const vaulted=createVaultedCeiling({scene,INCH,box,rod,cylinder,m,paint,trim,glowTexture,reflections});
const bakedLighting=window.ROOM_BAKE_EXPORT?{metadata:null,setLighting(){}}:await installBakedLighting(scene);
const westWallPainting=inspired.addWestWallPainting();
const updateWestPaintingLighting=followWallLighting(scene,westWallPainting);
const windowSeating=await installWindowSeating(inspired,photoMaterials);
const seatingLighting=window.ROOM_BAKE_EXPORT?{metadata:null,setLighting(){}}:await installSeatingLighting(scene);
const floorOriginals=oakMats.map(mat=>({map:mat.map,roughness:mat.roughness}));
let activeDesign=1,activeRoom='bedroom',office;
const roomPoses={};
let yaw=0,pitch=0,dragging=false,lastX=0,lastY=0,fanOn=false,night=false;
const keys=new Set(),touchMoves=new Set();
const viewpoints={entry:{p:[132,64,105],target:[58,37,143]},windows:{p:[26,64,65],target:[85,35,143]},bed:{p:[13,64,143],target:[91,40,33]},desk:{p:[91,48,55],target:[91,43,8]},center:{p:[119,64,62],target:[58,38,139]}};
function updateRotation(){camera.rotation.order='YXZ';camera.rotation.set(pitch,yaw,0);}
function setView(name){const v=viewpoints[name];camera.position.set(...v.p.map(n=>n*INCH));const d=new THREE.Vector3(...v.target.map(n=>n*INCH)).sub(camera.position).normalize();yaw=Math.atan2(-d.x,-d.z);pitch=Math.asin(d.y);camera.fov=70;camera.updateProjectionMatrix();updateRotation();}
setView('entry');
viewport.addEventListener('pointerdown',e=>{if(e.button!==0)return;dragging=true;lastX=e.clientX;lastY=e.clientY;viewport.setPointerCapture(e.pointerId);viewport.focus({preventScroll:true});viewport.style.cursor='grabbing';});
viewport.addEventListener('pointermove',e=>{if(!dragging)return;yaw-=(e.clientX-lastX)*.004;pitch=THREE.MathUtils.clamp(pitch-(e.clientY-lastY)*.004,-1.4,1.4);lastX=e.clientX;lastY=e.clientY;updateRotation();});
function endDrag(){dragging=false;viewport.style.cursor='grab';}
viewport.addEventListener('pointerup',endDrag);viewport.addEventListener('pointercancel',endDrag);viewport.style.cursor='grab';
viewport.addEventListener('wheel',e=>{e.preventDefault();camera.fov=THREE.MathUtils.clamp(camera.fov+e.deltaY*.025,40,90);camera.updateProjectionMatrix();},{passive:false});
addEventListener('keydown',e=>{if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.code)){e.preventDefault();keys.add(e.code);}});
addEventListener('keyup',e=>keys.delete(e.code));addEventListener('blur',()=>{keys.clear();touchMoves.clear();endDrag();});
function allowed(x,z){if(activeRoom==='office')return office.allowed(x,z);const pad=6*INCH;if(x<pad||z<pad||x>(169*INCH-pad)||z>(187*INCH-pad))return false;if(x>(124*INCH-pad)&&z>(120*INCH-pad))return false;for(const c of colliders)if(Math.abs(x-c.x)<c.w+pad&&Math.abs(z-c.z)<c.d+pad)return false;return true;}
function walk(dt){let forward=(keys.has('KeyW')||keys.has('ArrowUp')||touchMoves.has('forward')?1:0)-(keys.has('KeyS')||keys.has('ArrowDown')||touchMoves.has('back')?1:0);let side=(keys.has('KeyD')||keys.has('ArrowRight')||touchMoves.has('right')?1:0)-(keys.has('KeyA')||keys.has('ArrowLeft')||touchMoves.has('left')?1:0);if(!forward&&!side)return;const len=Math.hypot(forward,side);forward/=len;side/=len;const speed=dt*.9;const x=camera.position.x+(-Math.sin(yaw)*forward+Math.cos(yaw)*side)*speed,z=camera.position.z+(-Math.cos(yaw)*forward-Math.sin(yaw)*side)*speed;if(allowed(x,camera.position.z))camera.position.x=x;if(allowed(camera.position.x,z))camera.position.z=z;}
function lighting(evening){
  night=evening;
  if(activeRoom==='office'){
    office.setLighting(evening);renderer.toneMapping=THREE.AgXToneMapping;renderer.toneMappingExposure=evening?1.15:1.05;
    $('day-night').textContent=evening?'☾ Night':'☀ Day';$('day-night').setAttribute('aria-pressed',String(evening));$('day-night').setAttribute('aria-label',evening?'Switch to day':'Switch to night');return;
  }
  const enhanced=activeDesign===4;
  bakedLighting.setLighting(evening,enhanced);
  updateWestPaintingLighting();
  seatingLighting.setLighting(evening,enhanced);
  scene.background=evening?new THREE.Color('#000000'):skybox;
  exterior.visible=!evening;
  nightExterior.visible=evening;
  hemi.intensity=enhanced?.025:(evening?.2:1.3);
  hemi.visible=!enhanced;sun.visible=!enhanced;
  sun.intensity=enhanced||evening?0:3;
  windowLights.forEach((l,i)=>l.intensity=enhanced||evening||(i===2&&activeDesign===1)?0:14);
  windowLights.forEach(light=>light.visible=!enhanced);
  windowGlazing.forEach(mat=>{mat.opacity=evening?.045:.035;mat.color.set(evening?'#b2c3d0':'#e2eef3');});
  windowGlows.forEach(mat=>mat.opacity=evening?0:.025);
  closedWestShutters.visible=false;
  shutters.forEach(group=>group.visible=activeDesign===1);
  fanLight.intensity=activeDesign===1?(evening?14:5):0;
  fanLight.visible=activeDesign===1;
  lamps.forEach(l=>l.intensity=activeDesign===1?(evening?4:1.2):0);
  lamps.forEach(light=>light.visible=activeDesign===1);
  inspired.setLighting(evening);
  vaulted.setLighting(evening,enhanced);
  for(const light of [...inspired.lights,...inspired.galleryLights])light.visible=!enhanced;
  hallLight.visible=!enhanced;
  if(enhanced){for(const light of [...inspired.lights,...inspired.galleryLights])light.intensity=0;hallLight.intensity=0;}
  else hallLight.intensity=18;
  globeMat.emissiveIntensity=evening?1.7:.3;
  renderer.toneMapping=enhanced?THREE.AgXToneMapping:THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=enhanced?1:(evening?1.1:.95);
  $('day-night').textContent=evening?'☾ Night':'☀ Day';
  $('day-night').setAttribute('aria-pressed',String(evening));
  $('day-night').setAttribute('aria-label',evening?'Switch to day':'Switch to night');
  reflections.update({environment:activeDesign>=2});
}
$('day-night').onclick=()=>lighting(!night);
function setDesign(number){
  if(![1,2,3,4].includes(number))return;
  if(activeRoom==='office')setRoom('bedroom');
  activeDesign=number;const redesign=number>=2,vault=number>=3;
  photoMaterials.setQuality(redesign);
  furniture.visible=!redesign;fanGroup.visible=!redesign;inspired.group.visible=redesign;
  north.visible=!redesign;doubleNorth.visible=redesign;
  entryWall.visible=!redesign;originalEntryDoor.visible=!redesign;
  centeredEntryWall.visible=redesign;centeredEntryDoor.visible=redesign;
  ceiling.visible=!vault;vaulted.group.visible=vault;inspired.ceilingFixture.visible=!vault;
  vaulted.flatCap.visible=number===4;
  inspired.setFeatureHeight(vault?vaulted.height(187):96);
  for(const crown of wallCrowns)for(const mesh of crown.meshes)mesh.visible=(!vault||crown.group===north||crown.group===doubleNorth)&&!(redesign&&crown.group===south);
  paint.color.set(redesign?'#eeeae4':'#8fa7b7');paint.roughness=redesign?.42:.75;
  paint.normalMap=redesign?inspired.plasterMaps.normalMap:null;
  paint.roughnessMap=redesign?inspired.plasterMaps.roughnessMap:null;
  paint.normalScale.set(.16,.16);paint.needsUpdate=true;
  trim.color.set(redesign?'#f0ede7':'#efeee3');trim.roughness=redesign?.6:.5;ceilingMat.color.set(redesign?'#f0ebe0':'#f3f0e5');
  for(const inset of doorInsets){inset.color.set(redesign?'#f0ede7':'#d9dbd0');inset.roughness=redesign?.6:.55;}
  oakMats.forEach((mat,i)=>{
    mat.map=redesign?inspired.floorFinish.map:floorOriginals[i].map;
    mat.normalMap=redesign?inspired.floorFinish.normalMap:null;
    mat.roughnessMap=redesign?inspired.floorFinish.roughnessMap:null;
    mat.normalScale.set(.22,.22);mat.roughness=redesign?.72:floorOriginals[i].roughness;mat.needsUpdate=true;
  });
  colliders.splice(0,colliders.length,...(redesign?inspired.colliders:originalColliders));
  if(!allowed(camera.position.x,camera.position.z))setView('entry');
  for(const button of document.querySelectorAll('[data-design]'))button.setAttribute('aria-pressed',String(Number(button.dataset.design)===number));
  const url=new URL(location.href);url.searchParams.set('design',String(number));history.replaceState(null,'',url);
  lighting(night);
}
for(const button of document.querySelectorAll('[data-design]'))button.onclick=()=>setDesign(Number(button.dataset.design));
const planCanvas=$('plan-canvas');
const housePlan=createHousePlan({canvas:planCanvas,getState:()=>({activeRoom,activeDesign,camera,yaw,doorWidth:office?.dimensions.pocketDoorWidth}),onSelect:setRoom});
function drawPlan(){housePlan.draw();}
function setRoom(name){
  if(!office||!['bedroom','office'].includes(name)||name===activeRoom)return;
  roomPoses[activeRoom]={position:camera.position.toArray(),yaw,pitch,fov:camera.fov};
  keys.clear();touchMoves.clear();endDrag();activeRoom=name;
  const saved=roomPoses[name];
  if(saved){camera.position.fromArray(saved.position);yaw=saved.yaw;pitch=saved.pitch;camera.fov=saved.fov;camera.updateProjectionMatrix();updateRotation();}
  else if(name==='office'){
    const v=office.view;camera.position.set(...v.p.map(n=>n*INCH));const d=new THREE.Vector3(...v.target.map(n=>n*INCH)).sub(camera.position).normalize();yaw=Math.atan2(-d.x,-d.z);pitch=Math.asin(d.y);camera.fov=74;camera.updateProjectionMatrix();updateRotation();
  }else setView('entry');
  $('design-picker').hidden=name==='office';
  viewport.setAttribute('aria-label',`Interactive 3D ${name}. Drag to look; use W A S D or arrow keys to move.`);
  document.title=name==='office'?'Office | Room study':'Master bedroom | Room study';
  const url=new URL(location.href);if(name==='office')url.searchParams.set('room','office');else url.searchParams.delete('room');history.replaceState(null,'',url);
  lighting(night);drawPlan();
}
$('plan-toggle').onclick=()=>{
  const show=$('floor-plan').hidden;
  $('floor-plan').hidden=!show;
  $('plan-toggle').setAttribute('aria-expanded',String(show));
  $('plan-toggle').setAttribute('aria-pressed',String(show));
  if(show)drawPlan();
};
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});

let last=performance.now();
function animate(now){requestAnimationFrame(animate);const dt=Math.min((now-last)/1000,.05);last=now;walk(dt);if(fanOn)rotor.rotation.y+=dt*2.5;renderer.render(activeRoom==='office'?office.scene:scene,camera);if(!$('floor-plan').hidden)drawPlan();}
await photoMaterials.ready;
office=createOfficeRoom({photoMaterials,pocketDoorWidth:36});
const initialRoom=new URLSearchParams(location.search).get('room');
if(initialRoom==='office')await office.ready;
const initialDesign=Number(new URLSearchParams(location.search).get('design')||1);
setDesign([1,2,3,4].includes(initialDesign)?initialDesign:1);
if(initialRoom==='office')setRoom('office');
renderer.render(activeRoom==='office'?office.scene:scene,camera);$('loading').remove();requestAnimationFrame(animate);
// Read-only scene access is useful when checking dimensions and browser rendering.
window.roomStudy={scene,camera,renderer,ROOM,colliders,photoFloor,photoMaterials,antiqueFurniture,setView,allowed,lighting,setDesign,inspired,vaulted,ceiling,windowSeating,office,setRoom,housePlan,get activeRoom(){return activeRoom;},get activeScene(){return activeRoom==='office'?office.scene:scene;},quality:{refinedSoftgoods,bakedLighting:bakedLighting.metadata,seatingLighting:seatingLighting.metadata},get activeDesign(){return activeDesign;}};
