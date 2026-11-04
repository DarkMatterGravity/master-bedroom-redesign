import * as THREE from './vendor/three.module.js';

export function createPhotoMaterials(){
  const loader=new THREE.TextureLoader(),pending=[];
  // Use loadAsync below so missing assets fail explicitly instead of silently
  // leaving a white material in the room.
  function texture(path,color=false){const tex=new THREE.Texture();tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.anisotropy=16;if(color)tex.colorSpace=THREE.SRGBColorSpace;
    pending.push(loader.loadAsync(path).then(loaded=>{tex.image=loaded.image;tex.needsUpdate=true;}));return tex;}
  function maps(prefix){return {map:texture(`./Textures/${prefix}-albedo.png`,true),normalMap:texture(`./Textures/${prefix}-normal.png`),roughnessMap:texture(`./Textures/${prefix}-roughness.png`),aoMap:texture(`./Textures/${prefix}-ao.png`),displacementMap:texture(`./Textures/${prefix}-height.png`)};}
  const floorMaps=maps('floor'),woodMaps=maps('antique-wood');
  const familyPhoto=texture('./Images/References/Family-portrait.jpg',true);
  const floor=new THREE.MeshPhysicalMaterial({color:'#e6ded2',roughness:1,...floorMaps,normalScale:new THREE.Vector2(.8,.8),aoMapIntensity:.22,displacementScale:.00065,displacementBias:-.000325});
  const wood=new THREE.MeshPhysicalMaterial({color:'#d2d7dc',roughness:1,map:woodMaps.map,normalMap:woodMaps.normalMap,roughnessMap:woodMaps.roughnessMap,aoMap:woodMaps.aoMap,aoMapIntensity:.18,normalScale:new THREE.Vector2(.65,.65),bumpMap:woodMaps.displacementMap,bumpScale:.00018});
  const darkWood=wood.clone();darkWood.color.set('#b4b8bd');darkWood.roughness=.92;
  const verticalWood=wood.clone();
  const floorStain={enabled:{value:0},color:{value:new THREE.Color(.09,.07,.06)},luminance:{value:.5}};
  floor.onBeforeCompile=shader=>{
    shader.uniforms.floorStainEnabled=floorStain.enabled;shader.uniforms.floorStainColor=floorStain.color;shader.uniforms.floorBaseLuminance=floorStain.luminance;
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float floorStainEnabled;uniform vec3 floorStainColor;uniform float floorBaseLuminance;').replace('#include <map_fragment>',`#include <map_fragment>
      float floorGrain=clamp(dot(diffuseColor.rgb,vec3(.2126,.7152,.0722))/floorBaseLuminance,.45,1.65);
      diffuseColor.rgb=mix(diffuseColor.rgb,floorStainColor*mix(1.0,floorGrain,.8),floorStainEnabled);`);
  };
  floor.customProgramCacheKey=()=> 'photo-floor-bed-stain-v1';
  for(const key of ['map','normalMap','roughnessMap','aoMap','bumpMap']){verticalWood[key]=wood[key].clone();verticalWood[key].center.set(.5,.5);verticalWood[key].rotation=Math.PI/2;verticalWood[key].needsUpdate=true;}
  // Reduce orange chroma while retaining the photographed grain, wear and
  // local brightness. Every antique-wood piece, including the bed, shares it.
  for(const material of [wood,darkWood,verticalWood]){
    material.userData.woodSaturation=.65;
    material.userData.woodContrast=.75;
    material.normalScale.set(.45,.45);
    material.aoMapIntensity=.12;
    material.bumpScale=.00012;
    material.onBeforeCompile=shader=>{
      shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#include <map_fragment>
        float woodLuminance=dot(diffuseColor.rgb,vec3(0.2126,0.7152,0.0722));
        diffuseColor.rgb=mix(vec3(woodLuminance),diffuseColor.rgb,0.65);
        diffuseColor.rgb=mix(vec3(0.09),diffuseColor.rgb,0.75);`);
    };
    material.customProgramCacheKey=()=> 'photo-antique-wood-muted-065-contrast-075';
  }
  const ready=Promise.all(pending).then(()=>{
    function average(material){const c=document.createElement('canvas');c.width=c.height=16;const ctx=c.getContext('2d');ctx.drawImage(material.map.image,0,0,16,16);const p=ctx.getImageData(0,0,16,16).data,result=new THREE.Color(0,0,0);for(let i=0;i<p.length;i+=4)result.add(new THREE.Color().setRGB(p[i]/255,p[i+1]/255,p[i+2]/255,THREE.SRGBColorSpace));return result.multiplyScalar(1/256).multiply(material.color);}
    const timber=average(wood),lum=timber.r*.2126+timber.g*.7152+timber.b*.0722;
    timber.lerp(new THREE.Color(lum,lum,lum),.35).multiplyScalar(.75).addScalar(.09*.25);
    floorStain.color.value.copy(timber);const originalFloor=average(floor);floorStain.luminance.value=originalFloor.r*.2126+originalFloor.g*.7152+originalFloor.b*.0722;
    floor.userData.stainColor=timber.toArray();
    for(const key of ['map','normalMap','roughnessMap','aoMap','bumpMap']){verticalWood[key].image=wood[key].image;verticalWood[key].needsUpdate=true;}
    floor.needsUpdate=wood.needsUpdate=darkWood.needsUpdate=verticalWood.needsUpdate=true;
  });
  return {floor,wood,darkWood,verticalWood,familyPhoto,ready,
    setQuality(enabled){
      floorStain.enabled.value=enabled?1:0;floor.userData.stainEnabled=!!enabled;
      floor.roughness=enabled?.68:1;floor.clearcoat=enabled?.24:0;floor.clearcoatRoughness=.4;floor.normalScale.setScalar(enabled?.35:.8);
      for(const material of [wood,darkWood,verticalWood]){material.roughness=enabled?.7:(material===darkWood?.92:1);material.clearcoat=enabled?.18:0;material.clearcoatRoughness=.38;material.normalScale.setScalar(enabled?.3:.45);material.needsUpdate=true;}
      floor.needsUpdate=true;
    }};
}

export function createPhotoFloor(scene,material){
  const group=new THREE.Group();group.name='photo-hardwood-floor';scene.add(group);
  const inch=.0254,tile=32*inch;
  for(const [x,z,w,d] of [[0,0,124,187],[124,0,45,120]]){
    const geometry=new THREE.PlaneGeometry(w*inch,d*inch,Math.ceil(w),Math.ceil(d));geometry.rotateX(-Math.PI/2);geometry.translate((x+w/2)*inch,0,(z+d/2)*inch);
    const p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++)uv.setXY(i,p.getX(i)/tile,-p.getZ(i)/tile);
    geometry.setAttribute('uv1',uv.clone());const floor=new THREE.Mesh(geometry,material);floor.receiveShadow=true;floor.name='displaced-hardwood-floor';group.add(floor);
  }
  group.userData={tileSizeInches:32,maximumReliefMillimeters:.65};return group;
}
