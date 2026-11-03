import * as THREE from './vendor/three.module.js';

// A complete photographic back layer prevents bare background at the limits
// of the measured frames. Existing calibrated patches always draw over it.
export function createExteriorCoverage({front,water,frontTexture,waterTexture,north,yawScale,night,origin}){
  const radius=26,geometry=new THREE.PlaneGeometry(1,1,192,64),p=geometry.attributes.position,uv=geometry.attributes.uv;
  const frontUV=new Float32Array(p.count*2),waterUV=new Float32Array(p.count*2),weight=new Float32Array(p.count);
  function project(camera,angle,elevation){
    const yaw=angle/yawScale+north,ray=[Math.sin(yaw),-Math.tan(elevation)-(night?.075:0),Math.cos(yaw)],r=camera.rotation;
    const x=r[0][0]*ray[0]+r[1][0]*ray[1]+r[2][0]*ray[2],y=r[0][1]*ray[0]+r[1][1]*ray[1]+r[2][1]*ray[2],z=Math.max(.035,r[0][2]*ray[0]+r[1][2]*ray[1]+r[2][2]*ray[2]);
    return [(x/z*camera.focal+camera.ppx)/camera.width,1-(y/z*camera.focal+camera.ppy)/camera.height];
  }
  for(let i=0;i<p.count;i++){
    const angle=(uv.getX(i)*2-1)*Math.PI,elevation=(uv.getY(i)*2-1)*83*Math.PI/180;
    p.setXYZ(i,origin.x+Math.sin(angle)*radius,origin.y+Math.tan(elevation)*radius,origin.z-Math.cos(angle)*radius);
    frontUV.set(project(front,angle,elevation),i*2);waterUV.set(project(water,angle,elevation),i*2);
    const blend=THREE.MathUtils.clamp((angle+Math.PI/2)/(Math.PI/2),0,1);weight[i]=blend*blend*(3-2*blend);
  }
  geometry.setAttribute('frontUV',new THREE.BufferAttribute(frontUV,2));geometry.setAttribute('waterUV',new THREE.BufferAttribute(waterUV,2));geometry.setAttribute('blendWeight',new THREE.BufferAttribute(weight,1));geometry.computeBoundingSphere();
  const material=new THREE.ShaderMaterial({
    uniforms:{photograph:{value:frontTexture},waterPhotograph:{value:waterTexture},frontBounds:{value:night?new THREE.Vector4(0,0,1,1):new THREE.Vector4(.025,.18,.96,1)}},
    depthWrite:false,side:THREE.DoubleSide,toneMapped:false,
    vertexShader:`attribute vec2 frontUV;attribute vec2 waterUV;attribute float blendWeight;varying vec2 uvFront;varying vec2 uvWater;varying float blend;
      void main(){uvFront=frontUV;uvWater=waterUV;blend=blendWeight;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D photograph;uniform sampler2D waterPhotograph;uniform vec4 frontBounds;varying vec2 uvFront;varying vec2 uvWater;varying float blend;
      void main(){vec3 a=texture2D(photograph,clamp(uvFront,frontBounds.xy,frontBounds.zw)).rgb;vec3 b=texture2D(waterPhotograph,clamp(uvWater,0.0,1.0)).rgb;
        gl_FragColor=vec4(mix(a,b,blend),1.0);
        #include <colorspace_fragment>
      }`
  });
  const mesh=new THREE.Mesh(geometry,material);mesh.name='continuous-exterior-coverage';mesh.renderOrder=-100;return mesh;
}
