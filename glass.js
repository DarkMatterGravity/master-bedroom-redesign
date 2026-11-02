import * as THREE from './vendor/three.module.js';

// A cached room cubemap provides subtle, view-dependent Fresnel reflections.
// Refresh on design/light changes, not every animation frame.
export function createWindowReflections(scene,renderer){
  const target=new THREE.WebGLCubeRenderTarget(128,{type:THREE.HalfFloatType,generateMipmaps:true,minFilter:THREE.LinearMipmapLinearFilter});
  const capture=new THREE.CubeCamera(.03,60,target);capture.position.set(62*.0254,60*.0254,90*.0254);scene.add(capture);
  const layers=[];
  const material=new THREE.ShaderMaterial({
    uniforms:{roomReflection:{value:target.texture}},transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec3 worldPoint; varying vec3 worldNormal;
      void main(){vec4 p=modelMatrix*vec4(position,1.0);worldPoint=p.xyz;worldNormal=normalize(mat3(modelMatrix)*normal);gl_Position=projectionMatrix*viewMatrix*p;}`,
    fragmentShader:`uniform samplerCube roomReflection;varying vec3 worldPoint;varying vec3 worldNormal;
      void main(){vec3 V=normalize(cameraPosition-worldPoint);vec3 N=normalize(worldNormal);
        vec3 ray=reflect(-V,N);vec3 reflected=textureCube(roomReflection,ray).rgb;
        float fresnel=0.04+0.96*pow(1.0-abs(dot(N,V)),5.0);
        float strength=clamp(fresnel*0.38,0.016,0.16);
        gl_FragColor=vec4(reflected,strength);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`
  });
  return {
    layers,
    addPane(parent,width,height,x,y,z){const pane=new THREE.Mesh(new THREE.PlaneGeometry(width*.0254,height*.0254),material);pane.name='window-reflection';pane.position.set(x*.0254,y*.0254,z*.0254);pane.renderOrder=1;parent.add(pane);layers.push(pane);return pane;},
    update(){const visibility=layers.map(layer=>layer.visible);layers.forEach(layer=>layer.visible=false);
      try{capture.update(renderer,scene);}finally{layers.forEach((layer,i)=>layer.visible=visibility[i]);}}
  };
}
