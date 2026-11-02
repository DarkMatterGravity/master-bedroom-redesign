// Rebuild inferred PBR maps from the generated, de-lit photo-reference albedos.
// PLAYWRIGHT_PATH can point to an existing Playwright installation.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');
const fs=require('node:fs');
(async()=>{
  const browser=await chromium.launch({channel:'chrome',headless:true});
  const page=await browser.newPage();await page.goto('http://127.0.0.1:8000/Textures/');
  for(const prefix of ['floor','antique-wood']){
    const result=await page.evaluate(async prefix=>{
      const size=1024,canvas=document.createElement('canvas');canvas.width=canvas.height=size;
      const ctx=canvas.getContext('2d',{willReadFrequently:true}),image=new Image();image.src=`/${'Textures'}/${prefix}-albedo.png`;await image.decode();ctx.drawImage(image,0,0,size,size);
      const pixels=ctx.getImageData(0,0,size,size).data,gray=new Float32Array(size*size);
      for(let i=0;i<gray.length;i++)gray[i]=Math.log(.02+(pixels[i*4]*.2126+pixels[i*4+1]*.7152+pixels[i*4+2]*.0722)/255);
      // Periodic, separable box blur removes color/illumination variation so a
      // darker board or knot is not mistaken for a deep geometric depression.
      function blur(src,r){const tmp=new Float32Array(src.length),out=new Float32Array(src.length),n=2*r+1;
        for(let y=0;y<size;y++){let sum=0;for(let k=-r;k<=r;k++)sum+=src[y*size+(k+size)%size];
          for(let x=0;x<size;x++){tmp[y*size+x]=sum/n;sum+=src[y*size+(x+r+1)%size]-src[y*size+(x-r+size)%size];}}
        for(let x=0;x<size;x++){let sum=0;for(let k=-r;k<=r;k++)sum+=tmp[((k+size)%size)*size+x];
          for(let y=0;y<size;y++){out[y*size+x]=sum/n;sum+=tmp[((y+r+1)%size)*size+x]-tmp[((y-r+size)%size)*size+x];}}
        return out;
      }
      const smooth=blur(gray,10),fine=blur(gray,2),heights=new Float32Array(gray.length);
      const isFloor=prefix==='floor';
      for(let i=0;i<gray.length;i++){
        const detail=gray[i]-smooth[i],fiber=gray[i]-fine[i];
        heights[i]=Math.max(.12,Math.min(.82,.5+detail*.19+fiber*.16));
      }
      const heightSmoothed=blur(heights,1),maps={};
      for(const kind of ['normal','height','roughness','ao']){
        const output=document.createElement('canvas');output.width=output.height=size;const c=output.getContext('2d'),data=c.createImageData(size,size);
        for(let y=0;y<size;y++)for(let x=0;x<size;x++){
          const i=y*size+x,p=i*4,h=heights[i];let r,g,b;
          if(kind==='normal'){
            const dx=(heights[y*size+(x+1)%size]-heights[y*size+(x+size-1)%size])*(isFloor?1.2:1.6);
            const dy=(heights[((y+1)%size)*size+x]-heights[((y+size-1)%size)*size+x])*(isFloor?1.2:1.6);
            const len=Math.hypot(dx,dy,1);r=(.5-dx/len*.5)*255;g=(.5+dy/len*.5)*255;b=(.5+.5/len)*255;
          }else if(kind==='height')r=g=b=h*255;
          else if(kind==='roughness')r=g=b=(isFloor?.5:.42)*255+Math.min(28,Math.abs(gray[i]-smooth[i])*55)+(h-.5)*22;
          else r=g=b=255-Math.max(0,heightSmoothed[i]-h)*100;
          data.data[p]=r;data.data[p+1]=g;data.data[p+2]=b;data.data[p+3]=255;
        }c.putImageData(data,0,0);maps[kind]=output.toDataURL('image/png').split(',')[1];
      }
      return {maps,width:image.width,height:image.height};
    },prefix);
    for(const [kind,data] of Object.entries(result.maps))fs.writeFileSync(`Textures/${prefix}-${kind}.png`,Buffer.from(data,'base64'));
    console.log(`${prefix}: ${result.width} × ${result.height} albedo; 1024 × 1024 normal, height, roughness and AO maps`);
  }
  await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1;});
