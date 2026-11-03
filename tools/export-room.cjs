// Export local scene geometry for Blender without changing the shared viewer.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
let browser;
(async()=>{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1500,height:1000}});
  await page.addInitScript(()=>window.ROOM_BAKE_EXPORT=true);
  await page.goto('http://127.0.0.1:8000/?design=4');await page.waitForFunction(()=>!!window.roomStudy,null,{timeout:120000});
  if(process.argv.includes('--original-softgoods'))await page.evaluate(()=>{roomStudy.scene.getObjectByName('blender-refined-softgoods').visible=false;roomStudy.inspired.group.traverse(o=>{if(o.userData.softgoods)o.visible=true;});});
  if(process.argv.includes('--baseline')){
    await page.evaluate(()=>roomStudy.setView('entry'));await page.screenshot({path:'previews/quality-baseline-day.png'});
    await page.locator('#day-night').click();await page.screenshot({path:'previews/quality-baseline-night.png'});await page.locator('#day-night').click();
  }
  const data=await page.evaluate(()=>{
    const r=roomStudy,meshes=[];r.scene.updateMatrixWorld(true);
    function average(material){
      const color=material.color?.clone();if(!color)return [0.5,0.5,0.5];
      const image=material.map?.image;
      if(image){const canvas=document.createElement('canvas');canvas.width=canvas.height=16;const c=canvas.getContext('2d');c.drawImage(image,0,0,16,16);const p=c.getImageData(0,0,16,16).data;const sum=[0,0,0];for(let i=0;i<p.length;i+=4)for(let k=0;k<3;k++){const s=p[i+k]/255;sum[k]+=s<.04045?s/12.92:((s+.055)/1.055)**2.4;}color.r*=sum[0]/256;color.g*=sum[1]/256;color.b*=sum[2]/256;}
      if(material.userData.woodSaturation){const lum=color.r*.2126+color.g*.7152+color.b*.0722;for(const k of ['r','g','b'])color[k]=(.09*.25+(lum*.35+color[k]*.65)*.75);}
      return color.toArray();
    }
    function visit(o,path,visible){visible=visible&&o.visible;if(!visible)return;
      if(['exterior','night-exterior','closed-west-plantation-shutters'].includes(o.name))return;
      if(o.isMesh&&o.geometry?.attributes.position&&o.material?.isMeshStandardMaterial&&!o.material.transparent){
        const g=o.geometry,p=g.attributes.position,uv=g.attributes.uv,positions=[];const e=o.matrixWorld.elements;
        for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i);positions.push(e[0]*x+e[4]*y+e[8]*z+e[12],e[1]*x+e[5]*y+e[9]*z+e[13],e[2]*x+e[6]*y+e[10]*z+e[14]);}
        meshes.push({id:path,name:o.name,softgoods:o.userData.softgoods||o.userData.materialRole||null,positions,uv:uv?Array.from(uv.array):[],indices:g.index?Array.from(g.index.array):[],grid:g.parameters?.widthSegments&&g.type==='PlaneGeometry'?[g.parameters.widthSegments,g.parameters.heightSegments]:null,dimensions:g.type==='BoxGeometry'?[g.parameters.width,g.parameters.height,g.parameters.depth]:null,transform:Array.from(o.matrixWorld.elements),color:average(o.material),emissive:o.material.emissive?.toArray(),emissiveIntensity:o.material.emissiveIntensity||0,roughness:o.material.roughness,metalness:o.material.metalness});
      }
      o.children.forEach((child,index)=>visit(child,path+'.'+index,visible));
    }
    visit(r.scene,'r',true);return {meshes};
  });
  fs.writeFileSync('previews/blender-scene.json',JSON.stringify(data));console.log(JSON.stringify({meshes:data.meshes.length,softgoods:data.meshes.filter(m=>m.softgoods).length}));await browser.close();
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
