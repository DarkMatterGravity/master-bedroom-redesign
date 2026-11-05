import * as THREE from './vendor/three.module.js';

export function createOfficeExterior(scene){
  const group=new THREE.Group();group.name='office-video-exterior';
  group.userData={type:'video-spherical-panorama',sourceVideo:'IMG_7622.MOV',ready:false};scene.add(group);
  const base='./Images/OfficeExterior/',version='?v=20261105-office-video';
  const ready=Promise.all([
    fetch(base+'manifest.json'+version).then(r=>{if(!r.ok)throw new Error('Office exterior calibration is missing');return r.json();}),
    new THREE.TextureLoader().loadAsync(base+'panorama-day.jpg'+version)
  ]).then(([manifest,texture])=>{
    texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
    const origin=new THREE.Vector3(...manifest.originInches).multiplyScalar(.0254),radius=manifest.radiusMeters;
    const geometry=new THREE.PlaneGeometry(1,1,192,96),p=geometry.attributes.position,uv=geometry.attributes.uv;
    for(let i=0;i<p.count;i++){
      const angle=(uv.getX(i)*2-1)*Math.PI,elevation=(uv.getY(i)-.5)*Math.PI;
      p.setXYZ(i,origin.x-Math.sin(angle)*Math.cos(elevation)*radius,origin.y+Math.sin(elevation)*radius,origin.z+Math.cos(angle)*Math.cos(elevation)*radius);
    }
    geometry.computeBoundingSphere();
    const material=new THREE.MeshBasicMaterial({map:texture,side:THREE.DoubleSide,depthWrite:false,toneMapped:false});
    const panorama=new THREE.Mesh(geometry,material);panorama.name='office-continuous-exterior';panorama.renderOrder=-100;group.add(panorama);
    Object.assign(group.userData,manifest,{ready:true,continuousCoverage:true});
  });
  // This is a daytime capture. The night view stays dark until night footage
  // is supplied, rather than presenting sunlit houses as a night photograph.
  return {group,ready,setLighting(night){group.visible=!night;}};
}
