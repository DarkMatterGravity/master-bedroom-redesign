import * as THREE from './vendor/three.module.js';

// Calibrated photo patches share a distant cylinder rather than following the
// camera or being pasted onto individual panes. Walls naturally mask the band.
export async function createPhotoExterior(scene){
  const response=await fetch('./Images/Exterior/cameras.json');
  if(!response.ok)throw new Error('Could not load exterior camera calibration');
  const cameras=await response.json(),loader=new THREE.TextureLoader();
  const group=new THREE.Group();group.name='exterior';scene.add(group);
  const radius=24,origin=new THREE.Vector3(62*.0254,60*.0254,75*.0254);
  const water=cameras.find(c=>c.image==='water.jpg'),front=cameras.find(c=>c.image==='front.jpg');
  const heading=c=>Math.atan2(c.rotation[0][2],c.rotation[2][2]);
  const north=heading(water),yawScale=(Math.PI/2)/(north-heading(front));
  await Promise.all(cameras.map(async(camera,index)=>{
    const texture=await loader.loadAsync(`./Images/Exterior/${camera.image}`);
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
      position.setXYZ(i,origin.x+Math.sin(angle)*radius,origin.y-ry/horizontal*radius,origin.z-Math.cos(angle)*radius);
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
  group.userData={type:'calibrated-cylindrical-photo-band',radiusMeters:radius,videoFrames:9,photographs:2,frontDirection:'west',waterDirection:'north'};
  return group;
}
