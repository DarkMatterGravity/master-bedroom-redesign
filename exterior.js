import * as THREE from './vendor/three.module.js';

// One pre-stitched environment; no overlapping cards or clamped projections.
export async function createPhotoExterior(scene,{night=false}={}){
  const group=new THREE.Group();group.name=night?'night-exterior':'exterior';group.visible=!night;scene.add(group);
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
