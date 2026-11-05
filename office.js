import * as THREE from './vendor/three.module.js';
import { createOfficeExterior } from './office-exterior.js?v=20261105-office-video';

// Measured porch-office footprint, in inches. Local +Z runs away from the
// pocket door; X=88 is the solid wall toward the main house.
export function createOfficeRoom({photoMaterials,pocketDoorWidth=36}){
  const I=.0254,scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);root.name='first-floor-office';
  const dimensions={width:88,depth:133,height:96,deskLength:73,pocketDoorWidth,windowWidth:33,ceilingEstimated:true};
  const colliders=[],windows=[],dayLights=[],nightLights=[];
  const mat=(color,roughness=.75,extra={})=>new THREE.MeshStandardMaterial({color,roughness,...extra});
  const wall=mat('#ddd2b5'),ceiling=mat('#d9d0b9'),trim=mat('#f3f2e9',.48),aluminum=mat('#b7bdb9',.38,{metalness:.35});
  const black=mat('#171b1c',.58),rubber=mat('#111719',.91),steel=mat('#444b4d',.36,{metalness:.7}),wood=mat('#554031',.62);
  const cabinet=mat('#232323',.65,{map:photoMaterials.wood.map,normalMap:photoMaterials.wood.normalMap,normalScale:new THREE.Vector2(.12,.12)});
  const box=(w,h,d,x,y,z,material=wall,parent=root,r=0)=>{
    const g=new THREE.BoxGeometry(w*I,h*I,d*I,r?4:1,r?4:1,r?4:1);
    if(r){const p=g.attributes.position,v=new THREE.Vector3(),q=new THREE.Vector3(),radius=Math.min(r,w/2,h/2,d/2)*I;
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i);q.set(THREE.MathUtils.clamp(v.x,-w*I/2+radius,w*I/2-radius),THREE.MathUtils.clamp(v.y,-h*I/2+radius,h*I/2-radius),THREE.MathUtils.clamp(v.z,-d*I/2+radius,d*I/2-radius));v.sub(q).normalize().multiplyScalar(radius).add(q);p.setXYZ(i,v.x,v.y,v.z);}g.computeVertexNormals();}
    const mesh=new THREE.Mesh(g,material);mesh.position.set(x*I,y*I,z*I);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  };
  const sphere=(rx,ry,rz,x,y,z,material,parent=root)=>{const mesh=new THREE.Mesh(new THREE.SphereGeometry(1,20,12),material);mesh.scale.set(rx*I,ry*I,rz*I);mesh.position.set(x*I,y*I,z*I);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const cylinder=(rt,rb,h,x,y,z,material,parent=root)=>{const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt*I,rb*I,h*I,32),material);mesh.position.set(x*I,y*I,z*I);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const rod=(a,b,r,material,parent=root)=>{const start=new THREE.Vector3(...a).multiplyScalar(I),end=new THREE.Vector3(...b).multiplyScalar(I),m=new THREE.Mesh(new THREE.CylinderGeometry(r*I,r*I,start.distanceTo(end),12),material);m.position.copy(start).add(end).multiplyScalar(.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.sub(start).normalize());m.castShadow=true;parent.add(m);return m;};
  const tube=(points,r,material,parent=root,closed=false)=>{const path=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p).multiplyScalar(I)),closed),m=new THREE.Mesh(new THREE.TubeGeometry(path,Math.max(24,points.length*4),r*I,8,closed),material);m.castShadow=true;parent.add(m);return m;};
  const collider=(x,z,w,d)=>colliders.push({x:x*I,z:z*I,w:w*I/2,d:d*I/2});
  const floor=photoMaterials.floor.clone();floor.onBeforeCompile=()=>{};floor.customProgramCacheKey=()=> 'office-original-oak';floor.color.set('#ddc8aa');floor.roughness=.76;floor.clearcoat=.1;floor.normalScale.set(.25,.25);
  const fg=new THREE.PlaneGeometry(88*I,133*I,1,1);fg.rotateX(-Math.PI/2);fg.translate(44*I,0,66.5*I);const uv=fg.attributes.uv,p=fg.attributes.position;
  for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/(32*I),-p.getZ(i)/(32*I));
  const floorMesh=new THREE.Mesh(fg,floor);floorMesh.name='office-oak-floor';floorMesh.receiveShadow=true;root.add(floorMesh);
  box(90,1,135,44,96.5,66.5,ceiling).name='office-flat-ceiling';
  box(2,96,133,89,48,66.5).name='office-solid-house-wall';
  // The door opens into the remaining porch, as in the photographs.
  const doorX=30,doorLeft=doorX-pocketDoorWidth/2,doorRight=doorX+pocketDoorWidth/2;
  box(doorLeft,96,3,doorLeft/2,48,-1.5);box(88-doorRight,96,3,(88+doorRight)/2,48,-1.5);box(pocketDoorWidth,16,3,doorX,88,-1.5);
  const door=new THREE.Group();door.name='office-pocket-door';door.userData={width:pocketDoorWidth,height:80,open:true};root.add(door);
  for(const x of [doorLeft-1,doorRight+1])box(2,81,1.2,x,40.5,.7,trim,door,.12);box(pocketDoorWidth+4,2,1.2,doorX,81,.7,trim,door,.12);
  box(1,79,3,doorLeft+.5,39.5,-1.5,trim,door);box(1,79,3,doorRight-.5,39.5,-1.5,trim,door);box(pocketDoorWidth,1,3,doorX,79.5,-1.5,trim,door);
  box(1.1,78,1.3,doorRight-1,39,-1.5,trim,door);box(.6,4,.2,doorRight-1,39,-.75,steel,door);
  const tile=mat('#d9d1bf',.82),grout=mat('#ada896');box(88,1,58,44,-.6,-30,tile);box(2,96,58,89,48,-30);box(2,96,58,-1,48,-30,trim);box(88,96,2,44,48,-59,trim);
  for(let x=0;x<88;x+=12)box(.12,.03,58,x,.01,-30,grout);for(let z=-58;z<0;z+=12)box(88,.03,.12,44,.01,z,grout);
  box(30,73,.5,24,38,-57,trim);box(24,48,.6,24,47,-56.5,mat('#9eb9bd',.3));for(const x of [18,30])box(.8,48,.7,x,47,-56,trim);box(24,.8,.7,24,47,-56,trim);
  box(11,1,11,42,19.5,-37,black);for(const x of [37.5,46.5])for(const z of [-41.5,-32.5])box(.8,19,.8,x,9.5,z,black);
  cylinder(4,2.8,6,42,23,-37,mat('#9b5c43'));const plantGreen=mat('#4b7250');for(let j=0;j<9;j++){const a=j*2.4,x=42+7*Math.cos(a),z=-37+7*Math.sin(a),y=31+(j%3)*3;rod([42,25,-37],[x,y,z],.08,plantGreen);const leaf=sphere(3.6,.25,2.5,x,y,z,plantGreen);leaf.rotation.z=.35*Math.sin(a);leaf.rotation.y=a;}
  for(const x of [doorLeft/2,(88+doorRight)/2])box(x<doorX?doorLeft:88-doorRight,3.2,.65,x,1.6,.5,trim);
  box(.65,3.2,133,87.7,1.6,66.5,trim);
  // Five real window units: three along the desk and two across the end.
  function windowBank(length,starts,axis){
    const bank=new THREE.Group();bank.name=axis==='west'?'office-three-window-wall':'office-two-window-wall';root.add(bank);
    if(axis==='west'){bank.position.set(-1.5*I,0,133*I);bank.rotation.y=Math.PI/2;}else{bank.position.set(88*I,0,134.5*I);bank.rotation.y=Math.PI;}
    box(length,20,3,length/2,10,0,wall,bank);box(length,12,3,length/2,90,0,wall,bank);
    let previous=0;
    for(const start of starts){
      if(start>previous)box(start-previous,64,3,(start+previous)/2,52,0,wall,bank);
      const center=start+16.5,w=new THREE.Group();w.position.x=center*I;w.name='office-window';w.userData={width:33,sill:20,head:84,wall:axis};bank.add(w);windows.push(w);
      for(const x of [-17.2,17.2])box(2,67,1.2,x,52,2,trim,w,.08);for(const y of [19,85])box(36,2,1.2,0,y,2,trim,w,.08);
      box(37,1,4,0,19,2.5,trim,w,.1);
      for(const x of [-16,16])box(.65,63,1,x,52,.7,aluminum,w);
      for(const y of axis==='west'?[20.5,41.7,63,83.5]:[20.5,52,83.5])box(32,.8,1.1,0,y,.7,aluminum,w);
      const glass=new THREE.Mesh(new THREE.PlaneGeometry(31*I,62*I),new THREE.MeshPhysicalMaterial({color:'#dbe8e3',transparent:true,opacity:.065,roughness:.18,side:THREE.DoubleSide,depthWrite:false}));glass.position.set(0,52*I,0);w.add(glass);
      box(35,2.2,2.2,0,85.7,2.1,trim,w,.35);box(33,.5,1.1,0,84.3,2.6,trim,w);
      rod([17.8,83,2.5],[17.8,66,2.5],.07,mat('#b7b3a9'),w);
      previous=start+33;
    }
    if(previous<length)box(length-previous,64,3,(length+previous)/2,52,0,wall,bank);
    box(length,3.2,.65,length/2,1.6,2,trim,bank);
  }
  windowBank(133,[12,50,88],'west');windowBank(88,[9,46],'end');
  // The 73-inch black workstation, with a pen display, second monitor and tray.
  const desk=new THREE.Group();desk.name='office-73-inch-desk';desk.userData={length:73,depth:24,top:30};root.add(desk);
  box(24,1.2,73,12,29.4,56.5,cabinet,desk,.25);
  for(const z of [24,89]){box(22,28,1.1,12,14,z,cabinet,desk);box(21,2,1.3,12,1,z,black,desk);}
  box(1,15,70,1,20,56.5,cabinet,desk);box(11,20,17,7,10,82,black,desk,.4);
  for(const y of [5,11,17]){box(.4,.3,11,12.8,y,82,steel,desk);}
  box(11,.8,25,25,27.7,44,black,desk,.4);rod([18,27.5,31],[28,27.5,31],.2,steel,desk);rod([18,27.5,57],[28,27.5,57],.2,steel,desk);
  function screenTexture(code=false){const c=document.createElement('canvas');c.width=1024;c.height=640;const ctx=c.getContext('2d');ctx.fillStyle=code?'#141921':'#323b49';ctx.fillRect(0,0,1024,640);ctx.fillStyle='#222a34';ctx.fillRect(0,0,1024,36);ctx.fillStyle='#bacbd1';ctx.font='15px monospace';ctx.fillText(code?'workspace / project':'Creative workspace',20,24);
    if(code){for(let i=0;i<31;i++){ctx.fillStyle=['#9ab6d4','#a5bb99','#c4a58b','#d3ccd1'][i%4];ctx.fillRect(65+(i%5)*15,54+i*17,110+(i*37)%580,3);ctx.fillStyle='#596575';ctx.fillText(String(i+1),15,59+i*17);}}
    else{ctx.fillStyle='#778b97';ctx.fillRect(120,70,690,470);ctx.fillStyle='#b8bcb3';ctx.beginPath();ctx.moveTo(300,450);ctx.lineTo(470,155);ctx.lineTo(690,450);ctx.closePath();ctx.fill();ctx.fillStyle='#343e4d';ctx.fillRect(850,60,150,550);for(let i=0;i<14;i++){ctx.fillStyle='#8d9ca2';ctx.fillRect(870,90+i*31,100,5);}}
    const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
  function monitor(width,height,x,y,z,tilt,code){
    const base=new THREE.Group();base.name=code?'office-pen-display':'office-secondary-monitor';base.position.set(x*I,y*I,z*I);base.rotation.y=Math.PI/2;root.add(base);
    const panel=new THREE.Group();panel.rotation.x=tilt;base.add(panel);box(width+.9,height+.9,1.2,0,0,0,black,panel,.35);
    const display=new THREE.Mesh(new THREE.PlaneGeometry(width*I,height*I),new THREE.MeshBasicMaterial({map:screenTexture(code),toneMapped:false}));display.position.z=.63*I;panel.add(display);
    box(11,.5,8,x,30.3,z,black);rod([x,30.5,z],[x,y-2,z],.6,steel);return base;
  }
  monitor(27,17,13,42,44,-.4,true);monitor(25,15,8,48,81,-.05,false);
  const keyboard=new THREE.Group();keyboard.position.set(26*I,28.5*I,43*I);root.add(keyboard);box(7,.6,19,0,0,0,rubber,keyboard,.25);
  const keyWhite=mat('#bcbcb0'),keyGray=mat('#626d70'),keyRed=mat('#a96b62');for(let row=0;row<5;row++)for(let col=0;col<15;col++)box(.85,.25,.85,-2.4+row*1.05,.43,-8.4+col*1.13,col===0?keyRed:(row+col)%4?keyWhite:keyGray,keyboard,.08);
  sphere(1,.6,1.7,27,28.8,58,rubber);cylinder(1.5,1.45,7.5,15,34,23,steel);
  rod([21,30,64],[18,40,65],.35,black);rod([18,40,65],[23,43,60],.35,black);const mic=cylinder(1.2,1.2,5,23,43,60,rubber);mic.rotation.z=.55;
  collider(12,56.5,24,73);
  // Blue ergonomic mesh chair, facing the window-side desk.
  const chair=new THREE.Group();chair.name='office-blue-mesh-chair';chair.position.set(44*I,0,57*I);chair.rotation.y=Math.PI/2;root.add(chair);
  const meshCanvas=document.createElement('canvas');meshCanvas.width=meshCanvas.height=64;const mc=meshCanvas.getContext('2d');mc.fillStyle='#253e66';mc.fillRect(0,0,64,64);mc.strokeStyle='#5c7390';mc.lineWidth=1;for(let k=0;k<64;k+=4){mc.beginPath();mc.moveTo(k,0);mc.lineTo(k,64);mc.moveTo(0,k);mc.lineTo(64,k);mc.stroke();}
  const meshMap=new THREE.CanvasTexture(meshCanvas);meshMap.colorSpace=THREE.SRGBColorSpace;meshMap.wrapS=meshMap.wrapT=THREE.RepeatWrapping;meshMap.repeat.set(9,11);const blue=mat('#b0bfd5',.92,{map:meshMap,side:THREE.DoubleSide});
  box(20.5,2.8,19,0,18,0,blue,chair,1.3);box(18,1.2,16,0,16.3,0,rubber,chair,1);
  cylinder(1.3,1.6,11,0,9,0,steel,chair);
  for(let j=0;j<5;j++){const a=j*Math.PI*2/5;rod([0,5,0],[12*Math.sin(a),2.8,12*Math.cos(a)],.7,black,chair);const wheel=cylinder(1.35,1.35,1.3,12*Math.sin(a),1.4,12*Math.cos(a),rubber,chair);wheel.rotation.z=Math.PI/2;}
  const holesCanvas=document.createElement('canvas');holesCanvas.width=holesCanvas.height=64;const hc=holesCanvas.getContext('2d');hc.fillStyle='white';hc.fillRect(0,0,64,64);hc.fillStyle='black';for(let y=2;y<64;y+=4)for(let x=2;x<64;x+=4){hc.beginPath();hc.arc(x,y,1.3,0,Math.PI*2);hc.fill();}const holes=new THREE.CanvasTexture(holesCanvas);holes.wrapS=holes.wrapT=THREE.RepeatWrapping;holes.repeat.copy(meshMap.repeat);const meshBlue=blue.clone();meshBlue.alphaMap=holes;meshBlue.alphaTest=.45;
  const bg=new THREE.PlaneGeometry(20*I,23*I,32,28),bp=bg.attributes.position;for(let i=0;i<bp.count;i++){const u=bp.getX(i)/(10*I),v=(bp.getY(i)/(23*I)+.5);bp.setXYZ(i,u*(9.5+.5*Math.sin(v*Math.PI))*I,(24+23*v)*I,(7+2*(1-u*u)+1.2*Math.sin(v*Math.PI))*I);}bg.computeVertexNormals();const back=new THREE.Mesh(bg,meshBlue);back.castShadow=back.receiveShadow=true;chair.add(back);
  for(const side of [-1,1]){tube([[side*9.5,24,7],[side*10,34,7.5],[side*9.5,47,7]],.55,black,chair);box(3,1.3,10,side*12,26,-1,black,chair,.6);rod([side*9,17,3],[side*12,25,2],.6,black,chair);}
  rod([-9.5,24,7],[9.5,24,7],.65,black,chair);rod([-9.5,47,7],[9.5,47,7],.6,black,chair);sphere(8.2,3.6,1.7,0,51,8.5,blue,chair);tube([[-7,49,9],[0,47,10],[7,49,9]],.6,black,chair);collider(44,57,22,24);
  // The house-side wall is cleared for the redesign.
  const bedMat=mat('#b9b8ad',1);sphere(14,2.3,11,38,3,119,bedMat);const petRim=new THREE.Mesh(new THREE.TorusGeometry(11*I,2.6*I,12,48),bedMat);petRim.rotation.x=Math.PI/2;petRim.scale.x=1.2;petRim.position.set(38*I,4.3*I,119*I);root.add(petRim);
  const catBlack=mat('#242827',1),catWhite=mat('#deded0',1);sphere(3.4,2.9,5.3,11,33.7,73,catBlack);sphere(2.5,2.4,2.3,14,36,69,catBlack);sphere(1.7,1.3,.7,14.4,35,67,catWhite);sphere(1.5,1,2,15,31.7,68,catWhite);for(const z of [67.4,70.4]){const ear=new THREE.Mesh(new THREE.ConeGeometry(1.05*I,2.2*I,3),catBlack);ear.position.set(14*I,38.3*I,z*I);root.add(ear);}tube([[10,33,77],[7,33.5,76],[7,33,71]],.7,catBlack);
  // Low-profile ceiling fan with five timber blades.
  const fan=new THREE.Group();fan.name='office-ceiling-fan';fan.position.set(44*I,87*I,70*I);root.add(fan);cylinder(3.4,4,2,0,8,0,black,fan);rod([0,2,0],[0,7,0],.65,black,fan);sphere(4.5,2.7,4.5,0,0,0,black,fan);
  for(let j=0;j<5;j++){const blade=new THREE.Group();blade.rotation.y=j*Math.PI*2/5;fan.add(blade);box(7,.4,20,0,-.1,14,wood,blade,1.3);rod([0,0,3],[0,0,8],.4,steel,blade);}rod([1,-2,0],[1,-14,0],.06,black,fan);
  const exterior=createOfficeExterior(scene),yard=exterior.group,ready=exterior.ready;
  const sky=new THREE.HemisphereLight('#dbe8f2','#82765e',1.3);scene.add(sky);dayLights.push(sky);
  const sun=new THREE.DirectionalLight('#fff5df',2.5);sun.position.set(-140*I,220*I,230*I);sun.target.position.set(40*I,25*I,65*I);scene.add(sun,sun.target);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-4,right:4,top:4,bottom:-4,near:.5,far:15});sun.shadow.bias=-.00015;sun.shadow.normalBias=.008;dayLights.push(sun);
  const fill=new THREE.PointLight('#d9e8f6',8,7,2);fill.position.set(4*I,65*I,65*I);scene.add(fill);dayLights.push(fill);
  const ambient=new THREE.HemisphereLight('#b4c3d2','#5d5145',.24);scene.add(ambient);nightLights.push(ambient);const lampFill=new THREE.PointLight('#ffdfb0',8,6,2);lampFill.position.set(45*I,79*I,65*I);scene.add(lampFill);nightLights.push(lampFill);
  function setLighting(night){scene.background=new THREE.Color(night?'#101923':'#d8dcd9');dayLights.forEach(l=>l.visible=!night);nightLights.forEach(l=>l.visible=night);exterior.setLighting(night);}
  setLighting(false);
  return {scene,root,ready,dimensions,windows,colliders,door,desk,chair,fan,yard,setLighting,
    view:{p:[53,63,12],target:[25,41,100]},
    allowed(x,z){const pad=3*I;if(x<pad||z<pad||x>(88*I-pad)||z>(133*I-pad))return false;return !colliders.some(c=>Math.abs(x-c.x)<c.w+pad&&Math.abs(z-c.z)<c.d+pad);}};
}
