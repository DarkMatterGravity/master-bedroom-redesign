import * as THREE from './vendor/three.module.js';
import { miteredFrameBand } from './joinery.js';

export function createVaultedCeiling({scene,INCH,box,rod,cylinder,m,paint,trim,glowTexture,reflections}){
  const group=new THREE.Group();group.name='vaulted-ceiling';group.visible=false;scene.add(group);
  const ridgeZ=163,eave=96,pitch=Math.PI/6,rise=ridgeZ*Math.tan(pitch),peak=eave+rise;
  // Both roof planes use the same 30-degree pitch. The bed wall rises to meet
  // the short rear plane rather than forcing that plane down to eight feet.
  const height=z=>z<=ridgeZ?eave+z*Math.tan(pitch):peak-(z-ridgeZ)*Math.tan(pitch);
  const white=m('#f0eee6',.8),joint=m('#c4c3ba',.9);
  const boards=[];
  function roofPanel(z0,z1,width){
    const y0=height(z0)+.1,y1=height(z1)+.1;
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([
      0,y0*INCH,z0*INCH,width*INCH,y0*INCH,z0*INCH,width*INCH,y1*INCH,z1*INCH,0,y1*INCH,z1*INCH
    ],3));geometry.setIndex([0,1,2,0,2,3]);geometry.computeVertexNormals();
    const backing=new THREE.Mesh(geometry,joint);backing.material.side=THREE.DoubleSide;backing.castShadow=backing.receiveShadow=true;group.add(backing);
    const slope=(y1-y0)/(z1-z0),angle=Math.atan(slope),factor=Math.sqrt(1+slope*slope),step=5.5/factor;
    let row=0;
    for(let z=z0;z<z1-.001;z+=step){const end=Math.min(z+step,z1),mid=(z+end)/2,length=(end-z)*factor;
      // Staggered end joints distinguish individual painted shiplap boards.
      const split=row++%2?width*.64:width*.38;
      for(const [a,b] of [[0,split],[split,width]]){
        const board=box(b-a-.045,.5,length-.055,(a+b)/2,height(mid)+.25*Math.cos(angle),mid-.25*Math.sin(angle),white,group);
        board.rotation.x=-angle;board.name='white-shiplap-board';boards.push(board);
      }
    }
  }
  roofPanel(0,120,169);roofPanel(120,ridgeZ,124);roofPanel(ridgeZ,187,124);

  // Optional collar-tie ceiling: clip the peak at the top of the bed wall.
  // The 30-degree front slope meets this plane 48 inches before the bed wall.
  const flatHeight=height(187),flatStart=(flatHeight-eave)/Math.tan(pitch),flatDepth=187-flatStart;
  const flatCap=new THREE.Group();flatCap.name='collar-tie-flat-ceiling';flatCap.visible=false;group.add(flatCap);
  flatCap.userData={height:flatHeight,startZ:flatStart,endZ:187,depth:flatDepth,maximumVoidDepth:peak-flatHeight};
  box(124,.3,flatDepth,62,flatHeight+.65,(flatStart+187)/2,joint,flatCap);
  let flatRow=0;
  for(let z=flatStart;z<187-.001;z+=5.5){const end=Math.min(z+5.5,187),split=flatRow++%2?79:47;
    for(const [a,b] of [[0,split],[split,124]]){
      const board=box(b-a-.045,.5,end-z-.055,(a+b)/2,flatHeight+.25,(z+end)/2,white,flatCap);board.name='flat-shiplap-board';
    }
  }
  for(const x of [.4,123.6])rod([x,flatHeight-.65,flatStart],[x,flatHeight-.65,187],.6,trim,flatCap);

  // Extend the existing walls to the new roof profile, including the hallway notch.
  function upperWall(length,x,z,rotation,breaks,addTrim=true,opening=null){
    const points=[new THREE.Vector2(0,eave*INCH),new THREE.Vector2(length*INCH,eave*INCH)];
    for(const t of [...new Set([0,...breaks,length])].sort((a,b)=>b-a)){
      const wz=z-Math.sin(rotation)*t;points.push(new THREE.Vector2(t*INCH,height(wz)*INCH));
    }
    const s=new THREE.Shape(points);
    if(opening){const l=opening.start*INCH,r=(opening.start+opening.width)*INCH,b=opening.sill*INCH,t=(opening.sill+opening.height)*INCH;
      const hole=new THREE.Path();hole.moveTo(l,b);hole.lineTo(l,t);hole.lineTo(r,t);hole.lineTo(r,b);hole.closePath();s.holes.push(hole);}
    const geometry=new THREE.ExtrudeGeometry(s,{depth:4*INCH,bevelEnabled:false});geometry.translate(0,0,-4*INCH);
    const wall=new THREE.Mesh(geometry,paint);wall.position.set(x*INCH,0,z*INCH);wall.rotation.y=rotation;wall.castShadow=wall.receiveShadow=true;group.add(wall);
    const steps=[0,...breaks,length].sort((a,b)=>a-b);
    if(addTrim)for(let i=0;i<steps.length-1;i++){const a=steps[i],b=steps[i+1];const point=t=>[x+Math.cos(rotation)*t,height(z-Math.sin(rotation)*t)-.8,z-Math.sin(rotation)*t];rod(point(a),point(b),.65,trim,group);}
    return wall;
  }
  const highOpening={start:10,width:28,sill:peak-64,height:28};
  const gableWall=upperWall(187,0,187,Math.PI/2,[24],true,highOpening);gableWall.name='gable-wall-with-window';
  upperWall(120,169,0,-Math.PI/2,[]);upperWall(67,124,120,-Math.PI/2,[43]);
  upperWall(45,169,120,Math.PI,[]);
  const bedWall=upperWall(124,124,187,Math.PI,[],false);bedWall.name='vaulted-blue-bed-wall';
  // Small ridge cap joins the two fields of shiplap above the bed.
  box(124,.7,2.4,62,peak-.1,ridgeZ,trim,group);

  // A square Craftsman clerestory centered below the ridge on the side gable.
  // Its opening is a real hole, framed with simple flat casing on all four sides.
  const highWindow=new THREE.Group();highWindow.name='craftsman-gable-window';
  highWindow.position.set(0,0,187*INCH);highWindow.rotation.y=Math.PI/2;group.add(highWindow);
  highWindow.userData={width:28,height:28,ridgeClearance:36,sill:highOpening.sill,wall:'west'};
  const wx=24,wy=highOpening.sill+14,top=highOpening.sill+28,bottom=highOpening.sill;
  const recess=m('#c8c4b7',.6);
  for(const x of [wx-13.45,wx+13.45])box(1.1,28,4,x,wy,-1.6,recess,highWindow);
  for(const y of [bottom+.55,top-.55])box(28,1.1,4,wx,y,-1.6,recess,highWindow);
  const highGlass=new THREE.MeshBasicMaterial({color:'#fffbed',transparent:true,opacity:.97,depthWrite:false,toneMapped:false});
  const pane=box(25.8,25.8,.12,wx,wy,-1,highGlass,highWindow);pane.name='gable-window-glass';pane.castShadow=false;
  reflections.addPane(highWindow,25.8,25.8,wx,wy,-.85);
  // Upper-central sky from the matching nighttime sweep, without city/trees.
  const skyTexture=new THREE.TextureLoader().load('./Images/Exterior/Night/view-04.jpg',texture=>{
    const skyWidth=.34,skyHeight=skyWidth*texture.image.width/texture.image.height;
    texture.repeat.set(skyWidth,skyHeight);texture.offset.set(.32,.99-skyHeight);
  });skyTexture.colorSpace=THREE.SRGBColorSpace;skyTexture.anisotropy=8;
  const nightSky=new THREE.Mesh(new THREE.PlaneGeometry(28*INCH,28*INCH),new THREE.MeshBasicMaterial({map:skyTexture,toneMapped:false}));
  nightSky.name='upper-window-night-sky';nightSky.position.set(wx*INCH,wy*INCH,-2.3*INCH);nightSky.visible=false;highWindow.add(nightSky);
  miteredFrameBand(35,35,3.5,1.2,wx,wy,.7,trim,highWindow);
  const highGlowMat=new THREE.MeshBasicMaterial({map:glowTexture,transparent:true,opacity:.18,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false});
  const highGlow=new THREE.Mesh(new THREE.PlaneGeometry(46*INCH,48*INCH),highGlowMat);highGlow.position.set(wx*INCH,wy*INCH,2.3*INCH);highGlow.renderOrder=2;highWindow.add(highGlow);
  const highFill=new THREE.PointLight('#e2f0ff',6,4,2);highFill.position.set(5*INCH,wy*INCH,163*INCH);group.add(highFill);

  return {group,boards,flatCap,bedWall,gableWall,highWindow,height,peak,ridgeZ,pitchDegrees:30,rearPitchDegrees:30,
    setLighting(night){nightSky.visible=night;highGlass.color.set(night?'#b2c3d0':'#fffbed');highGlass.opacity=night?.045:.97;highGlowMat.opacity=night?0:.18;highFill.intensity=night?0:6;}};
}
