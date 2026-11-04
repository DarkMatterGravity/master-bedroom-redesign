const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
let browser;
(async()=>{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:1500,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const start=Date.now();await page.goto(process.env.ROOM_URL||'http://127.0.0.1:8000/?design=4');await page.waitForFunction(()=>!!window.roomStudy,null,{timeout:120000});
  const loadMs=Date.now()-start;
  const seating=await page.evaluate(()=>{const r=roomStudy,meshes=[];r.windowSeating.traverse(o=>{if(o.isMesh&&o.userData.seatingRole)meshes.push(o);});return {chairs:r.windowSeating.userData.chairs,meshes:meshes.length,lit:meshes.filter(o=>o.geometry.attributes.seatingday&&o.geometry.attributes.seatingnight).length,woodMatches:meshes.filter(o=>o.userData.seatingRole==='wood').every(o=>o.material.map===r.photoMaterials.wood.map),walkway:r.allowed(58*.0254,65*.0254),artLoaded:r.inspired.painting.children.some(o=>o.material?.map?.image?.width>1000)};});
  if(seating.chairs!==2||seating.meshes!==23||seating.lit!==23||!seating.woodMatches||!seating.walkway||!seating.artLoaded)errors.push('Seating or abstract artwork failed: '+JSON.stringify(seating));
  const facts=await page.evaluate(()=>{const r=roomStudy;let refined=0,baked=0;r.quality.refinedSoftgoods.traverse(o=>{if(o.isMesh)refined++;});r.scene.traverseVisible(o=>{if(o.isMesh&&o.material?.lightMap)baked++;});return {refined,baked,bake:r.quality.bakedLighting,environment:!!r.scene.environment,triangles:r.renderer.info.render.triangles};});
  for(const night of [false,true]){
    await page.evaluate(n=>roomStudy.lighting(n),night);
    await page.evaluate(()=>{const r=roomStudy;r.camera.position.set(118*.0254,64*.0254,84*.0254);r.camera.lookAt(53*.0254,19*.0254,28*.0254);});
    await page.screenshot({path:`previews/quality-seating-${night?'night':'day'}.png`});
  }
  await page.evaluate(()=>roomStudy.lighting(false));
  await page.evaluate(()=>{const r=roomStudy;r.camera.position.set(62*.0254,62*.0254,82*.0254);r.camera.lookAt(62*.0254,37*.0254,182*.0254);r.camera.fov=64;r.camera.updateProjectionMatrix();});
  await page.screenshot({path:'previews/quality-day-bed.png'});
  await page.click('#day-night');await page.screenshot({path:'previews/quality-night-bed.png'});
  await page.evaluate(()=>{roomStudy.camera.position.set(90*.0254,62*.0254,102*.0254);roomStudy.camera.lookAt(15*.0254,60*.0254,15*.0254);});
  await page.screenshot({path:'previews/quality-night-windows.png'});
  await page.click('#day-night');await page.screenshot({path:'previews/quality-day-windows.png'});
  const finish=await page.evaluate(()=>{const r=roomStudy,panel=r.inspired.group.getObjectByName('blue-wainscoting'),trim=r.vaulted.highWindow.getObjectByName('mitered-picture-frame').children[0];return {wallColor:panel.children[0].material.color.getHexString(),wallRoughness:panel.children[0].material.roughness,mouldingRoughness:panel.children[1].material.roughness,trimRoughness:trim.material.roughness};});
  if(finish.wallColor!=='eeeae4'||finish.wallRoughness!==.42||finish.mouldingRoughness!==.6||finish.trimRoughness!==.6)errors.push('Soft-white satin/eggshell finishes failed');
  for(const mode of ['day','night']){
    if(mode==='night')await page.click('#day-night');
    for(const [name,position,target] of [['gable',[87,65,109],[0,105,130]],['door',[100,64,92],[146,68,120]],['corner',[90,70,125],[124,133,170]],['base',[26,44,65],[0,15,42]],['upper-trim',[65,108,142],[0,140,163]],['west-painting',[70,64,94],[0,84,116]],['pillow-detail',[62,54,125],[62,39,172]],['duvet-foot',[110,43,84],[84,23,112]],['duvet-side',[112,32,115],[96,22,131]],['porch-roof',[25,64,42],[0,32,42]],['street-car',[20,64,40],[0,48,56]],['brown-house',[75,64,25],[91,41,0]],['near-fence',[62,64,15],[62,30,0]]]){
      await page.evaluate(({position,target})=>{const r=roomStudy;r.camera.position.set(...position.map(n=>n*.0254));r.camera.lookAt(...target.map(n=>n*.0254));r.camera.fov=60;r.camera.updateProjectionMatrix();},{position,target});
      await page.screenshot({path:`previews/smooth-${mode}-${name}.png`});
    }
  }
  await page.click('#day-night');
  const coverage=await page.evaluate(async()=>{
    const T=await import('./vendor/three.module.js'),r=roomStudy,misses=[];
    for(const night of [false,true]){
      r.lighting(night);
      r.scene.updateMatrixWorld(true);const sky=r.vaulted.highWindow.getObjectByName(night?'upper-window-night-sky':'upper-window-day-sky');
      for(const position of [[7,64,7],[7,64,180],[118,64,175]])for(const dz of [-8,0,8])for(const dy of [-8,0,8]){
        const origin=new T.Vector3(...position.map(v=>v*.0254)),target=new T.Vector3(0,(r.vaulted.peak-50+dy)*.0254,(163+dz)*.0254);
        const ray=new T.Raycaster(origin,target.sub(origin).normalize());
        const hit=ray.intersectObject(sky,false)[0];
        if(hit?.object.name!==(night?'upper-window-night-sky':'upper-window-day-sky')||hit.distance<15)misses.push({night,position,dz,dy,hit:hit?.object.name});
      }
    }
    const exteriorMisses=[];
    for(const night of [false,true]){
      r.lighting(night);const exterior=r.scene.getObjectByName(night?'night-exterior':'exterior'),back=exterior.getObjectByName('continuous-exterior-coverage');
      if(!back){if(night||exterior.userData.type!=='calibrated-cylindrical-photo-band'||exterior.children.length!==11)exteriorMisses.push({night,reason:'Original daytime band missing'});continue;}
      for(const position of [[7,64,7],[7,64,115],[118,64,7],[118,64,115]])for(const target of [[30,30,0],[54,80,0],[65,30,0],[92,80,0],[0,30,29],[0,80,55]]){
        const camera=new T.Vector3(...position.map(v=>v*.0254)),window=new T.Vector3(...target.map(v=>v*.0254)),direction=window.clone().sub(camera).normalize();
        const ray=new T.Raycaster(window.addScaledVector(direction,.002),direction);
        if(!ray.intersectObject(back,false).length)exteriorMisses.push({night,position,target});
      }
    }
    r.lighting(false);r.scene.updateMatrixWorld(true);
    const duvet=r.scene.getObjectByName('refined-soft-duvet-0'),throwMesh=r.scene.getObjectByName('refined-soft-throw-6'),mattress=r.scene.getObjectByName('variant-2-king-mattress'),clothMisses=[];
    const surfaces=[duvet,throwMesh,mattress];let clothRays=0;
    function clothRay(position,direction){const ray=new T.Raycaster(new T.Vector3(...position.map(v=>v*.0254)),new T.Vector3(...direction)),hit=ray.intersectObjects(surfaces,false)[0];clothRays++;if(hit?.object===mattress)clothMisses.push({position,direction});}
    for(const x of [24.1,25,26,30,50,62,75,95,98,99,99.9])for(const z of [103.1,104,105,106,110,115,125,145,165])clothRay([x,60,z],[0,-1,0]);
    for(const x of [26,28,35,62,90,97,98])for(const y of [18,20,22])clothRay([x,y,90],[0,0,1]);
    for(const z of [106,110,120,140,160])for(const y of [18,20,22]){clothRay([120,y,z],[-1,0,0]);clothRay([4,y,z],[1,0,0]);}
    return {upperCoverageMisses:misses,exteriorCoverageMisses:exteriorMisses,clothRays,clothMisses};
  });
  if(coverage.upperCoverageMisses.length||coverage.exteriorCoverageMisses.length||coverage.clothMisses.length)errors.push('Window or bedding coverage failed');
  await page.click('[data-design="1"]');
  const original=await page.evaluate(()=>{const r=roomStudy;let lightmaps=0;r.scene.traverseVisible(o=>{if(o.material?.lightMap)lightmaps++;});return {active:r.activeDesign,environment:r.scene.environment,lightmaps,floorStain:r.photoMaterials.floor.userData.stainEnabled};});
  await page.click('[data-design="4"]');
  if(facts.refined!==16||facts.baked<800||!facts.environment||original.active!==1||original.environment||original.lightmaps||original.floorStain)errors.push('Quality/before isolation failed');
  await page.close();
  const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(process.env.ROOM_URL||'http://127.0.0.1:8000/?design=4');await mobile.waitForFunction(()=>!!window.roomStudy,null,{timeout:120000});
  const mobileFacts=await mobile.evaluate(()=>{const r=roomStudy;let atlas=0;r.scene.traverseVisible(o=>{if(o.material?.lightMap)atlas=o.material.lightMap.image.width;});return {atlas,overflow:document.documentElement.scrollWidth>innerWidth,triangles:r.renderer.info.render.triangles};});
  await mobile.screenshot({path:'previews/quality-mobile.png'});if(mobileFacts.atlas!==1024||mobileFacts.overflow)errors.push('Mobile quality tier failed');
  const result={loadMs,seating,facts,finish,...coverage,original,mobileFacts,errors};fs.writeFileSync('previews/quality-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  await browser.close();if(errors.length)process.exitCode=1;
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
