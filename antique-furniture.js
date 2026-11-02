import * as THREE from './vendor/three.module.js';
import { addBlackFrame, miteredFrameBand } from './joinery.js';

// Measured footprints and photo-matched joinery, trim and hardware. The finish
// is shared between both pieces, but posts use vertically oriented grain.
export function createAntiqueFurniture({scene,INCH,box,rod,cylinder,m,materials}){
  const group=new THREE.Group();group.name='photo-matched-antique-furniture';scene.add(group);
  const wood=materials.wood,vertical=materials.verticalWood,dark=materials.darkWood;
  const hardware=m('#302e29',.38,{metalness:.75}),keyDark=m('#10120f',.8);
  function shapeMesh(points,depth,x,y,z,mat,parent){
    const shape=new THREE.Shape();for(const [i,p] of points.entries()){
      if(i===0)shape.moveTo(p[0]*INCH,p[1]*INCH);else shape.lineTo(p[0]*INCH,p[1]*INCH);
    }shape.closePath();
    const geo=new THREE.ExtrudeGeometry(shape,{depth:depth*INCH,bevelEnabled:true,bevelThickness:.06*INCH,bevelSize:.06*INCH,bevelSegments:2});geo.translate(0,0,-depth*INCH/2);
    // World-size UVs keep grain readable on the decorative shapes.
    const pos=geo.attributes.position,uv=geo.attributes.uv;for(let i=0;i<pos.count;i++)uv.setXY(i,pos.getX(i)/(24*INCH),pos.getY(i)/(12*INCH));
    const mesh=new THREE.Mesh(geo,mat);mesh.position.set(x*INCH,y*INCH,z*INCH);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;
  }
  function escutcheon(x,y,z,parent){
    const disk=cylinder(.4,.4,.12,x,y,z,hardware,parent);disk.rotation.x=Math.PI/2;
    const rim=new THREE.Mesh(new THREE.TorusGeometry(.38*INCH,.075*INCH,6,24),hardware);rim.position.set(x*INCH,y*INCH,(z+.1)*INCH);parent.add(rim);
    box(.11,.27,.06,x,y-.04,z+.16,keyDark,parent);
  }
  function pull(x,y,z,parent){
    for(const dx of [-1.7,1.7])box(.7,.55,.18,x+dx,y,z,hardware,parent,.12);
    const curve=new THREE.CatmullRomCurve3([
      new THREE.Vector3((x-1.7)*INCH,y*INCH,z*INCH),new THREE.Vector3((x-1.3)*INCH,(y-.25)*INCH,(z+.9)*INCH),
      new THREE.Vector3((x+1.3)*INCH,(y-.25)*INCH,(z+.9)*INCH),new THREE.Vector3((x+1.7)*INCH,y*INCH,z*INCH)
    ]);
    const handle=new THREE.Mesh(new THREE.TubeGeometry(curve,22,.13*INCH,8,false),hardware);handle.castShadow=true;parent.add(handle);
  }

  const chest=new THREE.Group();chest.name='antique-wood-chest';chest.position.set(62*INCH,0,91*INCH);group.add(chest);
  chest.userData={bodyWidth:48,bodyDepth:19,height:20.1};
  box(46,13,17.6,0,11.5,0,wood,chest,.18);
  // Recessed single front panel and a stepped molded frame.
  box(42.5,10,.32,0,11.5,-8.96,wood,chest,.12);
  for(const x of [-22,22]){
    box(1.2,13.5,1.1,x,11.5,-8.9,vertical,chest,.12);
    rod([x-.45,5,-9.5],[x-.45,18,-9.5],.10,dark,chest);
    rod([x+.45,5,-9.5],[x+.45,18,-9.5],.10,dark,chest);
  }
  for(const [y,w,d] of [[5.5,47,19],[6.1,46.5,18.7],[17.8,47.5,19.2]])box(w,.45,d,0,y,0,dark,chest,.08);
  for(const [y,w,d,h] of [[18.4,48.2,19.4,.6],[19.0,48.6,19.8,.4],[19.65,49,20,.9]])box(w,h,d,0,y,0,wood,chest,.14);
  // Shaped bracket feet and an uneven scalloped front apron, rather than a bench.
  const foot=[[-2.5,0],[2.5,0],[2.0,1.0],[1.6,2.5],[2.1,5],[-2.1,5],[-1.7,2.6],[-2,1.1]];
  for(const x of [-20.5,20.5])for(const z of [-7,7])shapeMesh(foot,3.1,x,0,z,vertical,chest);
  shapeMesh([[-21,7],[21,7],[21,4.5],[17,4.3],[14,3.7],[10,3.9],[6,3.2],[2,3.5],[0,3],[-2,3.5],[-6,3.2],[-10,3.9],[-14,3.7],[-17,4.3],[-21,4.5]],1,0,0,-8.1,wood,chest);
  // Front faces -Z, so the small keyhole plate points into the room.
  const key=cylinder(.34,.34,.12,0,16.5,-9.55,hardware,chest);key.rotation.x=Math.PI/2;
  box(.1,.25,.1,0,16.45,-9.65,keyDark,chest);

  const dresser=new THREE.Group();dresser.name='antique-five-drawer-dresser';dresser.position.set(158.5*INCH,0,72*INCH);dresser.rotation.y=-Math.PI/2;group.add(dresser);
  dresser.userData={bodyWidth:33,bodyDepth:19,height:51.3,drawers:5};
  box(31,44,18,0,26,0,wood,dresser,.2);
  for(const x of [-13,13])box(5,4,17,x,2,0,vertical,dresser,.3);
  box(34,1.5,20,0,4.2,0,dark,dresser,.12);
  for(const [y,w,d,h] of [[48.2,33.5,19.5,.6],[48.9,34,20,.7],[49.6,34.6,20.5,.6],[50.8,35.5,21.5,1]])box(w,h,d,0,y,0,wood,dresser,.12);
  // Framed side panels, with vertical-grain stiles.
  for(const side of [-1,1]){
    const x=side*15.8;
    box(.35,38,14.8,x,26,0,wood,dresser,.08);
    for(const z of [-7.5,7.5])box(.55,40,1.2,x,26,z,vertical,dresser,.08);
    for(const y of [6,46])box(.55,1.2,16,x,y,0,dark,dresser,.08);
    box(2.5,43,1.5,side*15,26.5,9.2,vertical,dresser,.12);
    for(const dx of [-.65,0,.65])for(const [y,h] of [[15,17],[37,19]])box(.065,h,.035,side*15+dx,y,9.98,dark,dresser);
    for(const y of [5.5,25,47])box(2.65,.9,1.65,side*15,y,9.2,dark,dresser,.08);
  }
  for(let i=0;i<5;i++){
    const y=9.6+i*8.2;
    const drawer=new THREE.Group();drawer.name=`antique-drawer-${i+1}`;dresser.add(drawer);
    box(28.2,7.8,.7,0,y,9.5,wood,drawer,.1);
    // The broad center panel, engraved linear bands and two drop/bail handles
    // follow the actual five-drawer dresser instead of the earlier plain model.
    box(14,4.1,.3,0,y-.6,10.0,wood,drawer,.12);
    for(const x of [-7.2,7.2])box(.42,4.6,.55,x,y-.6,10.1,dark,drawer,.1);
    for(const yy of [y-2.8,y+1.6])box(14.8,.42,.55,0,yy,10.1,dark,drawer,.1);
    for(const dy of [-2.9,-2.7,2.4,2.6])box(28.1,.04,.045,0,y+dy,9.875,dark,drawer);
    for(const x of [-8.6,8.6])box(.055,7.5,.045,x,y,9.875,dark,drawer);
    for(const x of [-10.7,10.7])pull(x,y-.3,10.1,drawer);
    escutcheon(0,y+2.8,10.1,drawer);
  }
  // The supplied family photograph, sampled directly from the original file.
  // UV coordinates isolate the real print without regenerating its subjects.
  const familyPicture=new THREE.Group();familyPicture.name='family-photo-above-dresser';familyPicture.position.set(169*INCH,0,72*INCH);familyPicture.rotation.y=-Math.PI/2;group.add(familyPicture);
  familyPicture.userData={width:20,height:20,centerHeight:72};
  const frameBlack=m('#171916',.45,{metalness:.15}),matPaper=m('#e9e0c9',.95),matBevel=m('#b8a78b',.7);
  addBlackFrame(20,20,2.6,0,72,1,frameBlack,familyPicture);
  box(14.8,14.8,.15,0,72,1.15,matPaper,familyPicture);
  miteredFrameBand(8.2,8.2,.3,.15,0,72,1.28,matBevel,familyPicture);
  const photoGeometry=new THREE.PlaneGeometry(7.6*INCH,7.6*INCH),uv=photoGeometry.attributes.uv;
  const photoCorners=[[.381,1-.351],[.609,1-.353],[.380,1-.645],[.603,1-.647]];
  photoCorners.forEach(([u,v],i)=>uv.setXY(i,u,v));
  const photo=new THREE.Mesh(photoGeometry,new THREE.MeshStandardMaterial({color:'#ffffff',map:materials.familyPhoto,roughness:.9}));
  photo.position.set(0,72*INCH,1.3*INCH);photo.receiveShadow=true;photo.name='original-family-photograph';familyPicture.add(photo);
  return {group,chest,dresser,familyPicture};
}
