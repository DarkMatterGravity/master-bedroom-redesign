import * as THREE from './vendor/three.module.js';
import { miteredRail, planPrism, addBlackFrame } from './joinery.js';

// Original, tileable material studies inferred from the inspiration photos.
// Color textures use sRGB. Normal/roughness maps remain linear data textures.
function surface(kind,base,repeat=1){
  const size=256,heights=new Float32Array(size*size);
  const color=new THREE.Color(base).getHex(THREE.SRGBColorSpace),rgb=[(color>>16)&255,(color>>8)&255,color&255];
  let seed=731;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const albedo=document.createElement('canvas');albedo.width=albedo.height=size;
  const ac=albedo.getContext('2d'),ai=ac.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,n=rnd();let h=.5,tone=1;
    if(kind==='wood'){
      const bend=Math.sin(y/256*Math.PI*2)*1.4+Math.sin(y/256*Math.PI*6)*.35;
      const fiber=Math.sin((x+bend)*.44+Math.sin(x*.15)*1.3)**12;
      h=.5-fiber*.025+(n-.5)*.025;
      tone=.96-fiber*.08+Math.sin(x*.039)*.025+n*.025;
    }else if(kind==='plaster'){
      h=.5+(n-.5)*.28+Math.sin(x*Math.PI/32)*Math.cos(y*Math.PI/32)*.1;tone=.96+n*.08;
    }else{
      const weave=Math.sin(x*Math.PI/2)*Math.cos(y*Math.PI/2),thread=(x%4<2?.07:-.07)+(y%4<2?.07:-.07);
      h=.5+weave*.2+thread+(n-.5)*.12;tone=.9+n*.13+weave*.035;
      if(kind==='rug'){h=.5+(n-.5)*.22+weave*.1;tone*=.97+.015*Math.sin(y*Math.PI/32)**2;}
    }
    heights[i]=h;const p=i*4;for(let k=0;k<3;k++)ai.data[p+k]=Math.min(255,rgb[k]*tone);ai.data[p+3]=255;
  }ac.putImageData(ai,0,0);
  const normal=document.createElement('canvas'),rough=document.createElement('canvas');normal.width=normal.height=rough.width=rough.height=size;
  const nc=normal.getContext('2d'),rc=rough.getContext('2d'),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const p=(y*size+x)*4,dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
    const v=new THREE.Vector3(-dx*1.9,-dy*1.9,1).normalize();ni.data[p]=(v.x*.5+.5)*255;ni.data[p+1]=(v.y*.5+.5)*255;ni.data[p+2]=(v.z*.5+.5)*255;ni.data[p+3]=255;
    const r=kind==='wood'?150+heights[y*size+x]*55:215+heights[y*size+x]*35;ri.data[p]=ri.data[p+1]=ri.data[p+2]=r;ri.data[p+3]=255;
  }nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  function tex(c,srgb=false){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
  const strength=kind==='wood'?.12:kind==='plaster'?.16:.2;
  return {map:tex(albedo,true),normalMap:tex(normal),roughnessMap:tex(rough),normalScale:new THREE.Vector2(strength,strength)};
}

function patternedMap(){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d');c.fillStyle='#ded9cc';c.fillRect(0,0,256,256);c.fillStyle='#47515a';
  for(let y=-32;y<288;y+=32)for(let x=-32;x<288;x+=32){const ox=x+(Math.floor(y/32)%2?16:0);c.beginPath();c.moveTo(ox,y);c.lineTo(ox+16,y);c.lineTo(ox+16,y+8);c.lineTo(ox+24,y+8);c.lineTo(ox+24,y+16);c.lineTo(ox+16,y+16);c.lineTo(ox+8,y+24);c.lineTo(ox,y+24);c.lineTo(ox+8,y+16);c.lineTo(ox,y+16);c.closePath();c.fill();}
  const t=new THREE.CanvasTexture(canvas);t.colorSpace=THREE.SRGBColorSpace;t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(2,2);t.anisotropy=8;return t;
}

function landscapePainting(){
  const canvas=document.createElement('canvas');canvas.width=1110;canvas.height=500;const c=canvas.getContext('2d');
  let seed=18973;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const sky=c.createLinearGradient(0,0,0,285);sky.addColorStop(0,'#d9d5c8');sky.addColorStop(1,'#9eafb0');c.fillStyle=sky;c.fillRect(0,0,1110,500);
  c.fillStyle='#6c8186';c.beginPath();c.moveTo(0,280);c.bezierCurveTo(180,240,260,278,420,252);c.bezierCurveTo(650,215,780,265,1110,230);c.lineTo(1110,500);c.lineTo(0,500);c.fill();
  c.fillStyle='#344f5c';c.beginPath();c.moveTo(0,235);c.bezierCurveTo(90,218,175,297,370,305);c.lineTo(430,345);c.lineTo(0,400);c.fill();
  const water=c.createLinearGradient(0,285,0,500);water.addColorStop(0,'#4d707a');water.addColorStop(1,'#213b49');c.fillStyle=water;c.fillRect(0,325,1110,175);
  c.fillStyle='#2b424d';c.beginPath();c.moveTo(1110,261);c.bezierCurveTo(970,258,930,321,760,342);c.lineTo(1110,395);c.fill();
  const colors=['#e4ddc7','#b7b9a8','#81979a','#4f6b74','#253e4a','#a28b60'];
  for(let i=0;i<11000;i++){const x=rnd()*1110,y=rnd()*500;c.globalAlpha=.035+rnd()*.13;c.fillStyle=colors[Math.floor(rnd()*colors.length)];c.fillRect(x,y,2+rnd()*29,.4+rnd()*2.5);}
  for(let i=0;i<160;i++){const y=321+rnd()*165,x=390+rnd()*310;c.globalAlpha=.12+rnd()*.23;c.fillStyle=i%3?'#d6c6a0':'#e2dbc5';c.fillRect(x,y,8+rnd()*75,.4+rnd()*1.2);}
  c.globalAlpha=1;const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

function portraitPainting(){
  const canvas=document.createElement('canvas');canvas.width=500;canvas.height=950;const c=canvas.getContext('2d');
  let seed=629;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  const background=c.createLinearGradient(0,0,0,950);background.addColorStop(0,'#d7d4c7');background.addColorStop(.48,'#a1b2b4');background.addColorStop(1,'#294a58');c.fillStyle=background;c.fillRect(0,0,500,950);
  c.fillStyle='#516c75';c.beginPath();c.moveTo(0,290);c.bezierCurveTo(145,340,220,440,360,482);c.lineTo(0,580);c.fill();
  c.fillStyle='#2d4955';c.beginPath();c.moveTo(500,590);c.bezierCurveTo(360,630,325,760,160,810);c.lineTo(500,950);c.fill();
  const colors=['#e5dfca','#b4b9ad','#80999d','#4b6d78','#243e4c','#a28e64'];
  for(let i=0;i<14500;i++){c.globalAlpha=.03+rnd()*.16;c.fillStyle=colors[Math.floor(rnd()*colors.length)];c.fillRect(rnd()*500,rnd()*950,2+rnd()*40,.5+rnd()*3.2);}
  c.globalAlpha=.4;c.strokeStyle='#b49a6c';c.lineWidth=1.7;c.beginPath();c.moveTo(370,0);c.bezierCurveTo(345,270,430,470,235,690);c.bezierCurveTo(180,780,300,860,175,950);c.stroke();
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;return texture;
}

export function createInspiredDesign({scene,INCH,box,sphere,cylinder,rod,m,photoMaterials}){
  const group=new THREE.Group();group.name='inspired-design';group.visible=false;scene.add(group);
  const solids=[],lights=[];
  const addCollider=(x,z,w,d)=>solids.push({x:x*INCH,z:z*INCH,w:w*INCH/2,d:d*INCH/2});
  const linenMaps=surface('linen','#ede8dc',7),walnutMaps=surface('wood','#725039',1),plasterMaps=surface('plaster','#ffffff',6),rugMaps=surface('rug','#b8b1a1',14);
  const linen=m('#ffffff',.95,linenMaps),white=m('#fffaf0',.95,surface('linen','#f3efe5',8));
  const curtainLinen=m('#ffffff',.95,surface('linen','#9c8c75',7));
  const slate=m('#ffffff',.95,surface('linen','#737e87',8));
  const walnut=m('#ffffff',.65,walnutMaps),brass=m('#a5884b',.32,{metalness:.8}),iron=m('#292d2b',.45,{metalness:.6});
  const fixtureBlack=m('#111412',.58,{metalness:.25}),frameBlack=m('#171916',.45,{metalness:.15});
  const panelPaint=m('#d8cebf',.75,{normalMap:plasterMaps.normalMap,normalScale:new THREE.Vector2(.16,.16),roughnessMap:plasterMaps.roughnessMap});
  const railPaint=m('#d8cebf',.55),chairHeight=60;
  const patterned=m('#ffffff',.93,{...surface('linen','#ffffff',8),map:patternedMap()});
  const floorFinish=surface('wood','#a58b69',1);

  // Applied paneling fits the measured openings; it never covers either window.
  function panelRun(length,x,z,rotation,height=chairHeight,corners={}){
    const start=corners.start||0,end=corners.end||0;
    const g=new THREE.Group();g.name='blue-wainscoting';g.userData.railHeight=height+1.6;g.position.set(x*INCH,0,z*INCH);g.rotation.y=rotation;group.add(g);
    miteredRail(length,height,.5,length/2,height/2,.65,panelPaint,g,start,end);
    miteredRail(length,1.5,1.3,length/2,height,.95,railPaint,g,start,end);
    miteredRail(length,1,1.7,length/2,height+1.1,1.05,railPaint,g,start,end);
    for(let a=1;a<length;a+=19){if((start&&a<2.5)||(end&&a>length-2.5))continue;box(1.8,height-4,.65,a,(height+4)/2,1,railPaint,g);}
    if(start)miteredRail(1.8,height-4,.65,.9,(height+4)/2,1,railPaint,g,start,0);
    if(end)miteredRail(1.8,height-4,.65,length-.9,(height+4)/2,1,railPaint,g,0,end);
    miteredRail(length,2,1.15,length/2,5,1,railPaint,g,start,end);
  }
  panelRun(67,124,120,-Math.PI/2,undefined,{start:-1});
  panelRun(22.3,169,0,-Math.PI/2,undefined,{start:1});
  panelRun(68.3,169,51.7,-Math.PI/2,undefined,{end:-1});
  panelRun(4.8,128.8,120,Math.PI,undefined,{end:1});
  panelRun(4.8,169,120,Math.PI,undefined,{start:1});
  panelRun(22.3,0,0,0,undefined,{start:1});
  panelRun(76.4,22.3,0,0,23);
  panelRun(70.3,98.7,0,0,undefined,{end:-1});
  panelRun(125.3,0,187,Math.PI/2);
  panelRun(39.4,0,61.7,Math.PI/2,23);
  panelRun(22.3,0,22.3,Math.PI/2,undefined,{end:-1});

  // Large flatweave rug and bound perimeter, all within the unnotched footprint.
  box(111,.38,116,62,.14,125,m('#ffffff',1,rugMaps),group,.12);
  const binding=m('#aaa496',1,surface('linen','#d8d0bd',10));
  for(const x of [7,117])box(.65,.12,115,x,.4,125,binding,group);
  for(const z of [67.5,182.5])box(111,.12,.65,62,.4,z,binding,group);
  for(let x=8;x<117;x+=.7)rod([x,.23,67],[x,.18,65.8],.035,binding,group);

  // Low solid-wood platform and broad slab headboard from the inspiration.
  // The 76 × 80 mattress remains at the same position and height.
  const bedFrame=new THREE.Group();bedFrame.name='antique-wood-platform-bed';group.add(bedFrame);
  bedFrame.userData={mattress:[76,80],frame:[84,84],platformTop:13,headboardTop:42};
  const bedWood=photoMaterials.wood;
  box(76,1,80,62,12.5,143,bedWood,bedFrame,.12);
  const baseStrips=[[[20,101],[24,103],[24,183],[20,185]],[[100,103],[104,101],[104,185],[100,183]],[[20,101],[104,101],[100,103],[24,103]],[[24,183],[100,183],[104,185],[20,185]]];
  for(const polygon of baseStrips)planPrism(polygon,13.1,6.45,bedWood,bedFrame,'floor-reaching-bed-panel');
  bedFrame.userData.baseClearance=0;
  box(84,36,2.2,62,24,184,bedWood,bedFrame,.2);
  // Smaller square slabs meet the headboard, with six inches to either wall.
  for(const x of [13,111]){
    const table=box(14,4,14,x,24,179,bedWood,bedFrame,.14);
    table.name='floating-bedside-table';
    table.userData={width:14,depth:14,thickness:4,topHeight:26,wallMounted:true};
    addCollider(x,179,14,14);
  }
  const mattress=box(76,10,80,62,18,143,white,group,2.5);mattress.name='variant-2-king-mattress';
  const duvetGeo=new THREE.PlaneGeometry(79*INCH,68*INCH,100,86);duvetGeo.rotateX(-Math.PI/2);
  const p=duvetGeo.attributes.position;
  for(let i=0;i<p.count;i++){const x=p.getX(i)/INCH,z=p.getZ(i)/INCH;const edge=Math.max(0,Math.abs(x)-36),foot=Math.max(0,-z-28);
    const folds=Math.sin(x*.32+z*.09)*.35+Math.sin(z*.38+x*.11)*.22+Math.sin(x*.7+z*.2)*.08;
    p.setY(i,Math.max(14,26.5-edge*1.65-foot*1.35+folds)*INCH);
  }duvetGeo.computeVertexNormals();const duvet=new THREE.Mesh(duvetGeo,white);duvet.position.set(62*INCH,0,137*INCH);duvet.castShadow=duvet.receiveShadow=true;group.add(duvet);
  for(const x of [43,81]){const pillow=box(33,7,18,x,29,173,white,group,3.1);pillow.rotation.x=.18;}
  for(const x of [48,76]){const pillow=box(19,16,6,x,35,163,patterned,group,2.4);pillow.rotation.x=-.12;pillow.rotation.z=x<62?.07:-.07;}
  box(30,8,5,62,31,158,slate,group,2);
  // Slate throw laid across the foot, following the duvet's draped sides.
  const throwGeo=new THREE.PlaneGeometry(79*INCH,18*INCH,100,25);throwGeo.rotateX(-Math.PI/2);
  const tp=throwGeo.attributes.position;
  for(let i=0;i<tp.count;i++){const x=tp.getX(i)/INCH,z=tp.getZ(i)/INCH;tp.setY(i,(27.8-Math.max(0,Math.abs(x)-36)*1.65+Math.sin(z*.7+x*.08)*.18)*INCH);}throwGeo.computeVertexNormals();
  const blanket=new THREE.Mesh(throwGeo,slate);blanket.position.set(62*INCH,0,116*INCH);blanket.castShadow=blanket.receiveShadow=true;group.add(blanket);
  addCollider(62,143,84,84);

  // White horizontal shiplap forms the complete feature wall.
  const featureWall=new THREE.Group();featureWall.name='white-shiplap-bed-feature-wall';group.add(featureWall);
  const featureBase=box(124,96,.3,62,48,186.65,m('#d0cec4',.9),featureWall);
  const shiplapPaint=m('#f2f0e7',.72,{normalMap:walnutMaps.normalMap,normalScale:new THREE.Vector2(.09,.09),roughnessMap:plasterMaps.roughnessMap});
  const featureBoards=[];
  for(let bottom=0,row=0;bottom<192;bottom+=5.5,row++){
    const split=row%2?79:47;
    for(const [a,b] of [[0,split],[split,124]]){
      const board=box(b-a-.045,5.445,.55,(a+b)/2,bottom+2.75,186,shiplapPaint,featureWall);
      board.name='feature-wall-shiplap-board';featureBoards.push({board,bottom});
    }
  }

  const sconceGlow=m('#f7ead0',.5,{emissive:'#ffdfab',emissiveIntensity:.7});
  for(const x of [12,112]){
    const sconce=new THREE.Group();sconce.name='bedside-wall-sconce';group.add(sconce);
    box(3.5,10,.5,x,65,185.9,fixtureBlack,sconce,.2);
    rod([x,63,185.8],[x,63,179],.3,fixtureBlack,sconce);
    cylinder(1.65,1.65,10,x,67,179,sconceGlow,sconce);
    for(const y of [61.7,72.3])cylinder(1.9,1.9,.6,x,y,179,fixtureBlack,sconce);
    const light=new THREE.PointLight('#ffdb9d',4,3,2);light.position.set(x*INCH,67*INCH,177*INCH);sconce.add(light);lights.push(light);
  }

  // Large framed landscape with a black gallery light, clear of the headboard.
  const painting=new THREE.Group();painting.name='large-headboard-painting';group.add(painting);
  painting.userData={width:62,height:28,bottom:65,top:93};
  const frame=frameBlack;
  box(62,28,.25,62,79,185.2,frame,painting);
  addBlackFrame(68,34,3,62,79,184.7,frameBlack,painting);
  painting.userData.frame={width:68,height:34,border:3};
  const art=new THREE.Mesh(new THREE.PlaneGeometry(62*INCH,28*INCH),m('#ffffff',.92,{map:landscapePainting(),normalMap:linenMaps.normalMap,normalScale:new THREE.Vector2(.08,.08),roughnessMap:linenMaps.roughnessMap}));
  art.rotation.y=Math.PI;art.position.set(62*INCH,79*INCH,184.8*INCH);art.receiveShadow=true;painting.add(art);
  const galleryFixture=new THREE.Group();galleryFixture.name='painting-gallery-light';group.add(galleryFixture);
  box(8,1.2,.4,62,94.5,185.5,fixtureBlack,galleryFixture,.1);
  for(const x of [58,66]){rod([x,94.5,185.4],[x,95.1,180],.16,fixtureBlack,galleryFixture);rod([x,95.1,180],[x,94.4,178.5],.16,fixtureBlack,galleryFixture);}
  const galleryBar=cylinder(.55,.55,24,62,94.4,178.5,fixtureBlack,galleryFixture);galleryBar.rotation.z=Math.PI/2;
  const galleryGlow=m('#fff1d2',.5,{emissive:'#ffdba4',emissiveIntensity:.6});box(22,.12,.6,62,93.85,178.5,galleryGlow,galleryFixture);
  const galleryLights=[];
  for(const [x,targetX] of [[54,46],[70,78]]){
    const spotlight=new THREE.SpotLight('#ffdfad',4,3,1.1,.7,2);spotlight.position.set(x*INCH,93.6*INCH,178*INCH);
    spotlight.target.position.set(targetX*INCH,79*INCH,185*INCH);group.add(spotlight,spotlight.target);galleryLights.push(spotlight);
  }
  // Keep the artwork balanced over the lower timber headboard.
  painting.position.y=-8*INCH;painting.userData.bottom-=8;painting.userData.top-=8;
  galleryFixture.position.y=-4*INCH;
  for(const spotlight of galleryLights){spotlight.position.y-=4*INCH;spotlight.target.position.y-=8*INCH;}

  // A tall companion painting is centered in the actual clear wall area:
  // curtain edge X=110 to the closet-side corner X=169, center X=139.5.
  const tallPainting=new THREE.Group();tallPainting.name='tall-painting-by-windows';tallPainting.position.set(139.5*INCH,55*INCH,3*INCH);group.add(tallPainting);
  tallPainting.userData={width:26,height:56,centerX:139.5,centerY:55,wallClearance:2.1};
  addBlackFrame(26,56,3,0,0,0,frameBlack,tallPainting);
  box(20,50,.2,0,0,.25,frameBlack,tallPainting);
  const portrait=new THREE.Mesh(new THREE.PlaneGeometry(20*INCH,50*INCH),m('#ffffff',.92,{map:portraitPainting(),normalMap:linenMaps.normalMap,normalScale:new THREE.Vector2(.08,.08)}));
  portrait.position.z=.4*INCH;portrait.receiveShadow=true;tallPainting.add(portrait);
  const tallGalleryFixture=new THREE.Group();tallGalleryFixture.name='tall-painting-gallery-light';tallPainting.add(tallGalleryFixture);
  box(5.5,1.2,.5,0,32,-2.7,fixtureBlack,tallGalleryFixture,.08);
  for(const x of [-3,3]){rod([x,32,-2.5],[x,32.2,3.2],.14,fixtureBlack,tallGalleryFixture);rod([x,32.2,3.2],[x,31,4.5],.14,fixtureBlack,tallGalleryFixture);}
  const portraitLightBar=cylinder(.45,.45,16,0,31,4.5,fixtureBlack,tallGalleryFixture);portraitLightBar.rotation.z=Math.PI/2;
  box(14,.1,.45,0,30.55,4.5,galleryGlow,tallGalleryFixture);
  const portraitLight=new THREE.SpotLight('#ffdfad',4,3,.75,.7,2);portraitLight.position.set(139.5*INCH,85.4*INCH,9.5*INCH);
  portraitLight.target.position.set(139.5*INCH,57*INCH,3.4*INCH);group.add(portraitLight,portraitLight.target);galleryLights.push(portraitLight);

  // The shared photo-matched chest and dresser replace the earlier concept
  // bench/dresser, while the design keeps their measured collision footprints.
  addCollider(62,91,49,20);addCollider(158.5,72,21,35);

  // Full-height, pleated linen curtains frame both windows without blocking them.
  function curtains(x,z,rotation,openingWidth=34){const g=new THREE.Group();g.name=openingWidth>34?'paired-window-curtains':'single-window-curtains';g.userData.panelCount=2;g.position.set(x*INCH,0,z*INCH);g.rotation.y=rotation;group.add(g);const offset=openingWidth/2+8;rod([-offset-5,89,4],[offset+5,89,4],.3,iron,g);
    for(const side of [-1,1]){const geo=new THREE.PlaneGeometry(12*INCH,77*INCH,100,96);const p=geo.attributes.position;
      for(let i=0;i<p.count;i++){
        const u=p.getX(i)/INCH,v=p.getY(i)/INCH,t=(v+38.5)/77;
        // Broad S folds gather gently at the rod and billow near the hem.
        const fold=Math.sin(u*2*Math.PI/7.5)*1.1+Math.sin(u*4*Math.PI/7.5+.25)*.12;
        p.setZ(i,(fold*(.35+.85*(1-t))+Math.sin(v*.055+side)*.14*(1-t))*INCH);
        p.setY(i,(v+Math.cos(u*2*Math.PI/7.5)*.1*(1-t)**4)*INCH);
      }geo.computeVertexNormals();
      const mat=curtainLinen.clone();mat.side=THREE.DoubleSide;const panel=new THREE.Mesh(geo,mat);panel.name='soft-s-fold-curtain';panel.position.set(side*offset*INCH,48.5*INCH,4*INCH);panel.castShadow=panel.receiveShadow=true;g.add(panel);
      for(let u=-5;u<=5;u+=2){const ring=new THREE.Mesh(new THREE.TorusGeometry(.6*INCH,.09*INCH,6,16),brass);ring.position.set((side*offset+u)*INCH,88.5*INCH,4*INCH);g.add(ring);}
    }
  }curtains(60.5,0,0,71);curtains(0,42,Math.PI/2);

  const ceilingFixture=new THREE.Group();group.add(ceilingFixture);
  return {group,bedFrame,ceilingFixture,featureWall,painting,tallPainting,galleryFixture,galleryLights,colliders:solids,lights,plasterMaps,floorFinish,bedSize:[76,80],
    setFeatureHeight(height){
      featureBase.scale.y=height/96;featureBase.position.y=height/2*INCH;
      for(const {board,bottom} of featureBoards){
        const visibleHeight=Math.max(0,Math.min(5.5,height-bottom));board.visible=visibleHeight>.055;
        if(board.visible){board.scale.y=(visibleHeight-.055)/5.445;board.position.y=(bottom+visibleHeight/2)*INCH;}
      }
      featureWall.userData.height=height;
    },
    setLighting(night){sconceGlow.emissiveIntensity=night?1.8:.5;for(const light of lights)light.intensity=night?7:.8;for(const light of galleryLights)light.intensity=night?4:1.2;galleryGlow.emissiveIntensity=night?1.2:.25;}
  };
}
