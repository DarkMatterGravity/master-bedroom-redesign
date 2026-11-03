import * as THREE from './vendor/three.module.js';
import { GLTFLoader } from './vendor/addons/loaders/GLTFLoader.js';
import { HDRLoader } from './vendor/addons/loaders/HDRLoader.js';

export async function installRefinedSoftgoods(inspired){
  const asset=await new GLTFLoader().loadAsync('./Assets/softgoods.glb');
  inspired.group.traverse(object=>{if(object.userData.softgoods)object.visible=false;});
  asset.scene.name='blender-refined-softgoods';
  asset.scene.traverse(object=>{
    if(!object.isMesh)return;
    const role=object.userData.materialRole||object.material.name;
    object.material=inspired.fabricMaterials[role];object.userData.materialRole=role;
    // glTF's UV convention accompanies flipY=false images. We reuse the
    // existing room's canvas textures, whose convention is flipY=true.
    const uv=object.geometry.attributes.uv;if(uv)for(let i=0;i<uv.count;i++)uv.setY(i,1-uv.getY(i));
    object.castShadow=object.receiveShadow=true;
  });
  inspired.group.add(asset.scene);return asset.scene;
}

const lightingAsset=path=>`${path}?v=20261103-coverage`;

export async function installBakedLighting(scene){
  const [manifest,buffer,clothDay,clothNight]=await Promise.all([
    fetch(lightingAsset('./Textures/Lighting/manifest.json')).then(r=>{if(!r.ok)throw new Error('Room lighting manifest missing');return r.json();}),
    fetch(lightingAsset('./Textures/Lighting/room-uv.bin')).then(r=>{if(!r.ok)throw new Error('Room lighting UVs missing');return r.arrayBuffer();}),
    fetch(lightingAsset('./Textures/Lighting/cloth-day.bin')).then(r=>r.arrayBuffer()),
    fetch(lightingAsset('./Textures/Lighting/cloth-night.bin')).then(r=>r.arrayBuffer())
  ]);
  const loader=new HDRLoader(),textures={};
  const mobile=matchMedia('(max-width: 700px)').matches;
  await Promise.all(['day','night'].map(async mode=>{
    const image=mobile?manifest.modes[mode].mobileImage:manifest.modes[mode].image;
    const texture=await loader.loadAsync(lightingAsset(`./Textures/Lighting/${image}`));
    texture.channel=1;texture.anisotropy=1;textures[mode]=texture;
  }));
  const entries=[],uvs=new Float32Array(buffer),cloth={day:new Uint16Array(clothDay),night:new Uint16Array(clothNight)};
  for(const record of manifest.records){
    let object=scene;
    for(const index of record.id.split('.').slice(1))object=object?.children[Number(index)];
    if(!object?.isMesh)throw new Error(`Baked room no longer matches mesh ${record.id}`);
    const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
    if(geometry.attributes.position.count!==record.count)throw new Error(`Baked UV count mismatch: ${record.id}`);
    geometry.setAttribute('uv1',new THREE.BufferAttribute(uvs.slice(record.offset*2,(record.offset+record.count)*2),2));
    if(record.softgoods)for(const mode of ['day','night'])geometry.setAttribute(`baked${mode}`,new THREE.Float16BufferAttribute(cloth[mode].slice(record.vertexOffset*3,(record.vertexOffset+record.count)*3),3));
    object.geometry=geometry;
    entries.push({object,original:object.material,baked:object.material.clone(),softgoods:record.softgoods});
  }
  return {
    metadata:{meshes:entries.length,atlasSize:manifest.size,method:manifest.geometry},
    setLighting(night,enabled){
      const mode=night?'night':'day';
      for(const {object,original,baked,softgoods} of entries){
        if(enabled){
          baked.copy(original);baked.onBeforeCompile=original.onBeforeCompile;baked.customProgramCacheKey=original.customProgramCacheKey;
          // Cycles diffuse bake is outgoing white-surface radiance; Three's
          // lightMap slot expects irradiance before the Lambert 1/pi factor.
          baked.lightMap=textures[mode];baked.lightMapIntensity=manifest.modes[mode].scale*Math.PI;
          if(softgoods){
            baked.lightMap=null;
            baked.onBeforeCompile=shader=>{
              shader.uniforms.clothNight={value:night?1:0};
              shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 bakedday;attribute vec3 bakednight;varying vec3 clothIrradiance;uniform float clothNight;').replace('#include <begin_vertex>','#include <begin_vertex>\nclothIrradiance=mix(bakedday,bakednight,clothNight);');
              shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 clothIrradiance;').replace('#include <lights_fragment_maps>','#include <lights_fragment_maps>\n#if defined(RE_IndirectDiffuse)\nirradiance+=clothIrradiance*PI;\n#endif');
            };
            baked.customProgramCacheKey=()=> 'cloth-vertex-gi-v1';
          }
          baked.aoMap=null;baked.needsUpdate=true;object.material=baked;
        }else object.material=original;
      }
    }
  };
}
