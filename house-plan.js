// A shared projected plan locates the first-floor office beside the upstairs
// bedroom. Each room keeps its own local navigation coordinates and floor label.
export const OFFICE_PLAN={x:-88,z:170,width:88,depth:133};
const SCALE=1.5,OX=179.25,OY=35;

export function createHousePlan({canvas,getState,onSelect}){
  canvas.width=480;canvas.height=530;
  const c=canvas.getContext('2d'),buttons=[...document.querySelectorAll('[data-room]')];let lastRoom;
  const region=(x,z)=>x>=OFFICE_PLAN.x&&x<=0&&z>=OFFICE_PLAN.z&&z<=OFFICE_PLAN.z+133?'office':x>=0&&x<=169&&z>=0&&z<=187&&!(x>124&&z>120)?'bedroom':null;
  function point(event){const r=canvas.getBoundingClientRect();return {x:((event.clientX-r.left)*canvas.width/r.width-OX)/SCALE,z:((event.clientY-r.top)*canvas.height/r.height-OY)/SCALE};}
  canvas.addEventListener('click',event=>{const p=point(event),room=region(p.x,p.z);if(room)onSelect(room);});
  canvas.addEventListener('pointermove',event=>{const p=point(event);canvas.style.cursor=region(p.x,p.z)?'pointer':'default';});
  for(const b of buttons)b.addEventListener('click',()=>onSelect(b.dataset.room));
  function draw(){
    const {activeRoom,activeDesign,camera,yaw,doorWidth=36}=getState();
    c.clearRect(0,0,480,530);c.save();c.translate(OX,OY);c.scale(SCALE,SCALE);
    c.beginPath();[[0,0],[169,0],[169,120],[124,120],[124,187],[0,187]].forEach(([x,z],i)=>i?c.lineTo(x,z):c.moveTo(x,z));c.closePath();
    c.fillStyle=activeRoom==='bedroom'?'#e0e8db':'#ecece4';c.fill();c.lineWidth=1.7;c.strokeStyle=activeRoom==='bedroom'?'#607e6a':'#a3aca0';c.stroke();
    c.fillStyle='#becabf';c.fillRect(24,103,76,80);c.fillStyle='#faf9f0';c.fillRect(27,166,31,14);c.fillRect(65,166,31,14);
    c.fillStyle='#a5b9b6';c.fillRect(38,81,48,19);c.fillStyle='#becabf';if(activeDesign===1)c.fillRect(70,1,41,21);c.fillRect(149,55.5,19,33);
    c.strokeStyle='#83afbb';c.lineWidth=3;c.beginPath();c.moveTo(25,0);c.lineTo(activeDesign===1?59:96,0);c.moveTo(0,25);c.lineTo(0,59);c.stroke();
    c.strokeStyle='#faf9f0';c.lineWidth=4;c.beginPath();c.moveTo(activeDesign===1?139:131.5,120);c.lineTo(activeDesign===1?169:161.5,120);c.moveTo(169,25);c.lineTo(169,49);c.stroke();
    c.fillStyle='#52695c';c.font='bold 10px Segoe UI, sans-serif';c.textAlign='center';c.fillText('Bedroom · 2F',82,42);
    c.save();c.translate(OFFICE_PLAN.x,OFFICE_PLAN.z);
    c.fillStyle=activeRoom==='office'?'#dce8e7':'#e8e9e1';c.fillRect(0,0,88,133);c.strokeStyle=activeRoom==='office'?'#527d7b':'#9ea99b';c.lineWidth=1.7;c.strokeRect(0,0,88,133);
    c.fillStyle='#94aaa8';c.fillRect(0,20,24,73);
    c.fillStyle='#6e8ba1';c.beginPath();c.ellipse(44,57,10,12,0,0,Math.PI*2);c.fill();
    c.strokeStyle='#83afbb';c.lineWidth=3;c.beginPath();for(const z of [12,50,88]){c.moveTo(0,z);c.lineTo(0,z+33);}for(const x of [9,46]){c.moveTo(x,133);c.lineTo(x+33,133);}c.stroke();
    c.strokeStyle='#faf9f0';c.lineWidth=4;c.beginPath();c.moveTo(30-doorWidth/2,0);c.lineTo(30+doorWidth/2,0);c.stroke();
    c.fillStyle='#476765';c.font='bold 10px Segoe UI, sans-serif';c.fillText('Office · 1F',44,110);c.restore();
    const offset=activeRoom==='office'?OFFICE_PLAN:{x:0,z:0};c.translate(offset.x+camera.position.x/.0254,offset.z+camera.position.z/.0254);c.rotate(-yaw);
    c.beginPath();c.moveTo(0,0);c.lineTo(-10,-17);c.quadraticCurveTo(0,-23,10,-17);c.closePath();c.fillStyle='#497d6835';c.fill();
    c.beginPath();c.arc(0,0,3.3,0,Math.PI*2);c.fillStyle='#42755f';c.fill();c.strokeStyle='#fffef5';c.lineWidth=1.2;c.stroke();c.restore();
    if(lastRoom!==activeRoom){for(const b of buttons)b.setAttribute('aria-pressed',String(b.dataset.room===activeRoom));lastRoom=activeRoom;}
  }
  return {draw,region,canvasPoint(room){const p=room==='office'?{x:-44,z:236.5}:{x:82,z:68};return {x:p.x*SCALE+OX,y:p.z*SCALE+OY};}};
}
