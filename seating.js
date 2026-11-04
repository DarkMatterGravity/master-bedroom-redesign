import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';

function leatherMaterial(slate){
  const sample=document.createElement('canvas');sample.width=sample.height=16;const sc=sample.getContext('2d');sc.drawImage(slate.map.image,0,0,16,16);
  const data=sc.getImageData(0,0,16,16).data,mean=new THREE.Color(0,0,0);
  for(let i=0;i<data.length;i+=4)mean.add(new THREE.Color().setRGB(data[i]/255,data[i+1]/255,data[i+2]/255,THREE.SRGBColorSpace));
  const base=mean.multiplyScalar(1/256).multiply(slate.color).convertLinearToSRGB().toArray().map(v=>v*255);
  const size=256,heights=new Float32Array(size*size),canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(size,size);let seed=4731;
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    seed=(seed*1664525+1013904223)>>>0;const n=seed/4294967296,i=y*size+x;
    const pore=Math.pow(n,6),tone=.94+n*.07+.018*Math.sin(x*.13)*Math.sin(y*.1);heights[i]=.5-pore*.16+(n-.5)*.06;
    for(let k=0;k<3;k++)pixels.data[i*4+k]=base[k]*tone;pixels.data[i*4+3]=255;
  }
  ctx.putImageData(pixels,0,0);
  const normal=document.createElement('canvas'),rough=document.createElement('canvas');normal.width=normal.height=rough.width=rough.height=size;
  const nc=normal.getContext('2d'),rc=rough.getContext('2d'),ni=nc.createImageData(size,size),ri=rc.createImageData(size,size);
  for(let y=0;y<size;y++)for(let x=0;x<size;x++){
    const i=y*size+x,p=i*4,dx=heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size],dy=heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x];
    const v=new THREE.Vector3(-dx,-dy,1).normalize();ni.data[p]=(v.x*.5+.5)*255;ni.data[p+1]=(v.y*.5+.5)*255;ni.data[p+2]=(v.z*.5+.5)*255;ni.data[p+3]=255;
    ri.data[p]=ri.data[p+1]=ri.data[p+2]=165+heights[i]*40;ri.data[p+3]=255;
  }
  nc.putImageData(ni,0,0);rc.putImageData(ri,0,0);
  function texture(c,srgb=false){const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(5,5);t.anisotropy=8;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t;}
  return new THREE.MeshPhysicalMaterial({map:texture(canvas,true),normalMap:texture(normal),roughnessMap:texture(rough),normalScale:new THREE.Vector2(.06,.06),roughness:.88,clearcoat:.04,clearcoatRoughness:.75,envMapIntensity:.18});
}

export async function installWindowSeating(inspired,photoMaterials){
  const asset=await new GLTFLoader().loadAsync('./Assets/window-seating.glb?v=20261103-chair-back');
  const group=asset.scene;group.name='window-reading-seating';group.userData={seatingGroup:true,chairs:2,chairSize:[30,31,31],tableDiameter:18,tableHeight:21.625};
  const leather=leatherMaterial(inspired.fabricMaterials.slate),seam=new THREE.MeshStandardMaterial({color:'#47545e',roughness:.82}),metal=new THREE.MeshStandardMaterial({color:'#151719',metalness:.8,roughness:.4}),flipped=new Set();
  group.traverse(o=>{if(o.isMesh){const role=o.userData.seatingRole||o.material.name;o.userData.seatingRole=role;o.material=role==='wood'?photoMaterials.wood:role==='metal'?metal:role==='pillow'?inspired.fabricMaterials.pattern:role==='pillow-seam'?inspired.fabricMaterials.white:role==='seam'?seam:leather;
    if(!flipped.has(o.geometry)){const uv=o.geometry.attributes.uv;if(uv)for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));flipped.add(o.geometry);}
    o.castShadow=o.receiveShadow=true;}});
  // Soft contact shadows supplement the fixed room atlas for the added pieces.
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d'),g=ctx.createRadialGradient(64,64,8,64,64,64);g.addColorStop(0,'rgba(0,0,0,.3)');g.addColorStop(.55,'rgba(0,0,0,.2)');g.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
  const shadowMap=new THREE.CanvasTexture(canvas);
  for(const [x,z,w,d] of [[28,29,35,36],[88,29,35,36],[58,32,20,20]]){
    const mesh=new THREE.Mesh(new THREE.PlaneGeometry(w*.0254,d*.0254),new THREE.MeshBasicMaterial({map:shadowMap,transparent:true,depthWrite:false}));mesh.rotation.x=-Math.PI/2;mesh.position.set(x*.0254,.018,z*.0254);mesh.name='seating-contact-shadow';group.add(mesh);
  }
  inspired.group.add(group);
  for(const [x,z,w,d] of [[28,29,38,39],[88,29,38,39],[58,32,18,18]])inspired.colliders.push({x:x*.0254,z:z*.0254,w:w*.0254/2,d:d*.0254/2});
  return group;
}

export async function installSeatingLighting(scene){
  const base='./Textures/Seating/',version='?v=20261103-chair-back';
  const [manifest,day,night]=await Promise.all([fetch(base+'manifest.json'+version).then(r=>{if(!r.ok)throw new Error('Seating lighting manifest missing');return r.json();}),fetch(base+'day.bin'+version).then(r=>r.arrayBuffer()),fetch(base+'night.bin'+version).then(r=>r.arrayBuffer())]);
  const values={day:new Uint16Array(day),night:new Uint16Array(night)},entries=[];
  for(const record of manifest.records){
    let object=scene;for(const i of record.id.split('.').slice(1))object=object?.children[Number(i)];
    if(!object?.isMesh)throw new Error('Seating lighting mesh missing: '+record.id);
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();if(geometry.attributes.position.count!==record.count)throw new Error('Seating lighting geometry mismatch');
    for(const mode of ['day','night'])geometry.setAttribute('seating'+mode,new THREE.Float16BufferAttribute(values[mode].slice(record.offset*3,(record.offset+record.count)*3),3));
    object.geometry=geometry;entries.push({object,original:object.material,baked:object.material.clone(),nightUniform:{value:0}});
  }
  return {metadata:manifest,setLighting(night,enabled){for(const {object,original,baked,nightUniform} of entries){
    nightUniform.value=night?1:0;
    if(!enabled){object.material=original;continue;}
    baked.copy(original);const compile=original.onBeforeCompile;
    baked.onBeforeCompile=shader=>{compile.call(original,shader);shader.uniforms.seatingNight=nightUniform;
      shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 seatingday;attribute vec3 seatingnight;varying vec3 seatingIrradiance;uniform float seatingNight;').replace('#include <begin_vertex>','#include <begin_vertex>\nseatingIrradiance=mix(seatingday,seatingnight,seatingNight);');
      shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 seatingIrradiance;').replace('#include <lights_fragment_maps>','#include <lights_fragment_maps>\n#if defined(RE_IndirectDiffuse)\nirradiance+=seatingIrradiance*PI;\n#endif');};
    baked.customProgramCacheKey=()=> 'seating-vertex-gi-v1-'+original.customProgramCacheKey();baked.needsUpdate=true;object.material=baked;
  }}};
}
