const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
let browser;
(async()=>{
  browser=await chromium.launch({channel:'chrome',headless:true,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const base=process.env.ROOM_URL||'http://127.0.0.1:8000/?design=4',url=new URL(base);url.searchParams.delete('room');url.searchParams.set('design','4');
  const page=await browser.newPage({viewport:{width:1400,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(url.href);await page.waitForFunction(()=>!!window.roomStudy,null,{timeout:120000});
  const bedroom=await page.evaluate(()=>({position:roomStudy.camera.position.toArray(),fov:roomStudy.camera.fov,bake:roomStudy.quality.bakedLighting.meshes}));
  await page.click('#plan-toggle');
  async function clickRoomOnPlan(p,room){const target=await p.evaluate(room=>{const canvas=document.querySelector('#plan-canvas'),r=canvas.getBoundingClientRect(),point=roomStudy.housePlan.canvasPoint(room);return {x:r.left+point.x/canvas.width*r.width,y:r.top+point.y/canvas.height*r.height};},room);await p.mouse.click(target.x,target.y);}
  await clickRoomOnPlan(page,'office');
  await page.waitForFunction(()=>roomStudy.office.yard.userData.ready===true);
  const office=await page.evaluate(()=>{const r=roomStudy;return {room:r.activeRoom,scene:r.activeScene===r.office.scene,dimensions:r.office.dimensions,windows:r.office.windows.length,allowed:r.allowed(r.camera.position.x,r.camera.position.z),deskCollision:r.allowed(12*.0254,50*.0254),wallCollision:r.allowed(90*.0254,60*.0254),route:r.allowed(61*.0254,90*.0254),backWallClear:r.allowed(80*.0254,51*.0254)&&r.allowed(78*.0254,117*.0254)&&!r.office.scene.getObjectByName('office-collection-storage'),exterior:r.office.yard.userData,url:location.search};});
  if(office.room!=='office'||!office.scene||office.dimensions.width!==88||office.dimensions.depth!==133||office.windows!==5||!office.allowed||office.deskCollision||office.wallCollision||!office.route)errors.push('Office geometry, plan navigation or collision failed');
  if(!office.backWallClear||office.exterior.sourceVideo!=='IMG_7622.MOV'||!office.exterior.ready||!office.exterior.continuousCoverage)errors.push('Office clear wall or video exterior failed');
  const exteriorCoverage=await page.evaluate(async()=>{
    const T=await import('./vendor/three.module.js'),r=roomStudy,pano=r.office.scene.getObjectByName('office-continuous-exterior'),misses=[];r.office.scene.updateMatrixWorld(true);let rays=0;
    for(const position of [[5,63,5],[83,63,5],[5,63,128],[83,63,128]])for(const y of [22,52,82])for(const target of [[0,y,28.5],[0,y,66.5],[0,y,104.5],[25.5,y,133],[62.5,y,133]]){
      const from=new T.Vector3(...position.map(v=>v*.0254)),to=new T.Vector3(...target.map(v=>v*.0254)),hit=new T.Raycaster(from,to.sub(from).normalize()).intersectObject(pano,false)[0];rays++;if(!hit||hit.distance<6)misses.push({position,target});
    }return {rays,misses};
  });
  if(exteriorCoverage.misses.length)errors.push('Office window exterior coverage failed');
  if(await page.locator('#design-picker').isVisible())errors.push('Bedroom design controls leaked into office');
  await page.screenshot({path:'previews/office-plan.png'});await page.click('#plan-toggle');
  const before=await page.evaluate(()=>roomStudy.camera.position.toArray());await page.locator('#viewport').focus();await page.keyboard.down('KeyW');await page.waitForTimeout(300);await page.keyboard.up('KeyW');
  const moved=await page.evaluate(()=>roomStudy.camera.position.toArray());if(Math.hypot(before[0]-moved[0],before[2]-moved[2])<.01)errors.push('Office walking failed');
  const officePose=await page.evaluate(()=>({position:roomStudy.camera.position.toArray(),fov:roomStudy.camera.fov}));
  await page.click('#plan-toggle');await clickRoomOnPlan(page,'bedroom');
  const returned=await page.evaluate(()=>({room:roomStudy.activeRoom,position:roomStudy.camera.position.toArray(),fov:roomStudy.camera.fov,env:!!roomStudy.scene.environment,bake:roomStudy.quality.bakedLighting.meshes}));
  if(returned.room!=='bedroom'||JSON.stringify(returned.position)!==JSON.stringify(bedroom.position)||returned.fov!==bedroom.fov||!returned.env||returned.bake!==901)errors.push('Bedroom pose or lighting did not restore');
  await page.click('[data-room="office"]');const restored=await page.evaluate(()=>roomStudy.camera.position.toArray());if(JSON.stringify(restored)!==JSON.stringify(officePose.position))errors.push('Office pose did not restore');
  await page.click('#plan-toggle');
  for(const [name,position,target] of [['entry',[53,63,12],[25,41,100]],['desk',[65,60,90],[10,38,43]],['storage',[27,63,94],[80,43,42]],['door',[57,64,103],[30,49,0]],['ceiling',[45,55,65],[44,91,70]],['end-exterior',[44,63,91],[44,54,134]],['side-exterior',[64,63,65],[0,53,65]],['end-edge',[8,63,126],[70,65,134]]]){
    await page.evaluate(({position,target})=>{const r=roomStudy;r.camera.position.set(...position.map(v=>v*.0254));r.camera.lookAt(...target.map(v=>v*.0254));r.camera.fov=72;r.camera.updateProjectionMatrix();},{position,target});await page.screenshot({path:`previews/office-${name}.png`});
  }
  await page.click('#day-night');await page.screenshot({path:'previews/office-night.png'});
  if(!await page.evaluate(()=>roomStudy.office.scene.background.getHexString()==='101923'))errors.push('Office night mode failed');
  if(await page.evaluate(()=>roomStudy.office.yard.visible))errors.push('Daytime exterior should be hidden at night');
  await page.click('#plan-toggle');await page.click('[data-room="bedroom"]');
  if(!await page.evaluate(()=>roomStudy.activeRoom==='bedroom'&&roomStudy.scene.background.isColor&&roomStudy.scene.background.getHex()===0))errors.push('Night mode did not follow the room switch');
  await page.click('[data-room="office"]');
  if(!await page.evaluate(()=>roomStudy.office.scene.background.getHexString()==='101923'))errors.push('Office night mode did not restore');
  await page.close();
  url.searchParams.set('room','office');const mobile=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:2,isMobile:true,hasTouch:true});mobile.on('pageerror',e=>errors.push(e.message));
  await mobile.goto(url.href);await mobile.waitForFunction(()=>!!window.roomStudy,null,{timeout:120000});
  if(!await mobile.evaluate(()=>roomStudy.activeRoom==='office'&&roomStudy.allowed(roomStudy.camera.position.x,roomStudy.camera.position.z)))errors.push('Direct office link failed');
  await mobile.click('#plan-toggle');await mobile.screenshot({path:'previews/office-mobile-plan.png'});await clickRoomOnPlan(mobile,'bedroom');
  if(!await mobile.evaluate(()=>roomStudy.activeRoom==='bedroom'))errors.push('Mobile map selection failed');await mobile.click('[data-room="office"]');await mobile.click('#plan-toggle');await mobile.screenshot({path:'previews/office-mobile.png'});
  if(await mobile.evaluate(()=>document.documentElement.scrollWidth>innerWidth))errors.push('Mobile overflow');
  const result={office,exteriorCoverage,bedroom,returned,poseRestored:true,errors};fs.writeFileSync('previews/office-check.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));await browser.close();if(errors.length)process.exitCode=1;
})().catch(async e=>{console.error(e);await browser?.close();process.exitCode=1;});
