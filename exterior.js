import * as THREE from './vendor/three.module.js';

// Original calibrated daytime photo band; the current night panorama remains available.
export async function createPhotoExterior(scene,{night=false}={}){
  const group=new THREE.Group();group.name=night?'night-exterior':'exterior';group.visible=!night;scene.add(group);
  if(!night)return createOriginalDayExterior(scene,group);
  const texture=await new THREE.TextureLoader().loadAsync(`./Images/Exterior/panorama-${night?'night':'day'}.jpg?v=20261103-anchored`);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
  const radius=24,origin=new THREE.Vector3(62*.0254,60*.0254,75*.0254);
  const geometry=new THREE.PlaneGeometry(1,1,192,96),p=geometry.attributes.position,uv=geometry.attributes.uv;
  for(let i=0;i<p.count;i++){
    const angle=(uv.getX(i)*2-1)*Math.PI,elevation=(uv.getY(i)-.5)*Math.PI;
    p.setXYZ(i,origin.x+Math.sin(angle)*Math.cos(elevation)*radius,origin.y+Math.sin(elevation)*radius,origin.z-Math.cos(angle)*Math.cos(elevation)*radius);
  }
  geometry.computeBoundingSphere();
  const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
  const panorama=new THREE.Mesh(geometry,material);panorama.name='continuous-exterior-coverage';panorama.renderOrder=-100;group.add(panorama);
  group.userData={type:'stitched-spherical-panorama',radiusMeters:radius,continuousCoverage:true,frontDirection:'west',waterDirection:'north',night};
  return group;
}

async function createOriginalDayExterior(scene,group){
  const night=false;
  const base=night?'./Images/Exterior/Night':'./Images/Exterior';
  const response=await fetch(`${base}/cameras.json`);
  if(!response.ok)throw new Error('Could not load exterior camera calibration');
  const cameras=await response.json(),loader=new THREE.TextureLoader();
  const radius=24,origin=new THREE.Vector3(62*.0254,60*.0254,75*.0254);
  const water=night?cameras[5]:cameras.find(c=>c.image==='water.jpg'),front=night?cameras[0]:cameras.find(c=>c.image==='front.jpg');
  const heading=c=>Math.atan2(c.rotation[0][2],c.rotation[2][2]);
  const north=heading(water),yawScale=(Math.PI/2)/(north-heading(front));
  await Promise.all(cameras.map(async(camera,index)=>{
    const texture=await loader.loadAsync(`${base}/${camera.image}`);
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const geometry=new THREE.PlaneGeometry(1,1,48,64);
    const position=geometry.attributes.position,uv=geometry.attributes.uv;
    geometry.setAttribute('blendUv',uv.clone());
    const r=camera.rotation,isFront=camera.image==='front.jpg';
    // Omit the photographed sill and jamb; the room already has real casing.
    const bounds=isFront?[.025,.96,0,.82]:[0,1,0,1];
    for(let i=0;i<position.count;i++){
      const u=THREE.MathUtils.lerp(bounds[0],bounds[1],uv.getX(i));
      const v=THREE.MathUtils.lerp(bounds[2],bounds[3],1-uv.getY(i));
      const x=(u*camera.width-camera.ppx)/camera.focal,y=(v*camera.height-camera.ppy)/camera.focal;
      const rx=r[0][0]*x+r[0][1]*y+r[0][2],ry=r[1][0]*x+r[1][1]*y+r[1][2],rz=r[2][0]*x+r[2][1]*y+r[2][2];
      const horizontal=Math.hypot(rx,rz),angle=(Math.atan2(rx,rz)-north)*yawScale;
      // The night camera points slightly down; level the distant water horizon.
      position.setXYZ(i,origin.x+Math.sin(angle)*radius,origin.y-(ry/horizontal+(night?.075:0))*radius,origin.z-Math.cos(angle)*radius);
      uv.setXY(i,u,1-v);
    }
    geometry.computeVertexNormals();geometry.computeBoundingSphere();
    const material=new THREE.ShaderMaterial({
      uniforms:{photograph:{value:texture}},transparent:true,depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
      vertexShader:`attribute vec2 blendUv;varying vec2 photoUv;varying vec2 featherUv;
        void main(){photoUv=uv;featherUv=blendUv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
      fragmentShader:`uniform sampler2D photograph;varying vec2 photoUv;varying vec2 featherUv;
        void main(){vec2 edge=min(featherUv,1.0-featherUv);
          float alpha=smoothstep(0.0,0.09,edge.x)*smoothstep(0.0,0.05,edge.y);
          gl_FragColor=vec4(texture2D(photograph,photoUv).rgb,alpha);
          #include <colorspace_fragment>
        }`
    });
    const patch=new THREE.Mesh(geometry,material);patch.name=`exterior-photo-${camera.image}`;
    patch.renderOrder=-20+index;group.add(patch);
  }));
  group.userData={type:'calibrated-cylindrical-photo-band',radiusMeters:radius,videoFrames:9,photographs:night?0:2,frontDirection:'west',waterDirection:'north',night};
  return group;
}
