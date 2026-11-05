"""Build a single spherical office panorama from the fixed-lens yard sweep.

Camera rotations are fitted with reciprocal feature matches and angular RANSAC
between nearby video frames. Intrinsics stay fixed, avoiding free focal-length
fits that can bend buildings. Stored frames/cameras make the blend reproducible.
"""
from pathlib import Path
import json,cv2,numpy as np,gc
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'Images/OfficeExterior';CACHE=ROOT/'previews/office-video';CACHE.mkdir(exist_ok=True)

def panorama():
    cameras=json.loads((BASE/'cameras.json').read_text());width,height=4096,2048;sw,sh=1024,512
    anchor=min(cameras,key=lambda c:abs(c['time']-2.05));r=np.array(anchor['rotation']);anchor_yaw=float(np.arctan2(r[0,2],r[2,2]))
    theta=(np.arange(width,dtype=np.float32)[None,:]/(width-1)*2-1)*np.pi
    elev=(.5-np.arange(height,dtype=np.float32)[:,None]/(height-1))*np.pi
    directions=np.empty((height,width,3),np.float32);directions[:,:,0]=np.sin(theta+anchor_yaw)*np.cos(elev);directions[:,:,1]=-np.sin(elev);directions[:,:,2]=np.cos(theta+anchor_yaw)*np.cos(elev)
    small=cv2.resize(directions,(sw,sh));images=[cv2.imread(str(BASE/c['image'])) for c in cameras]
    def warp(c,d):
        local=d@np.array(c['rotation'],np.float32);z=local[:,:,2];safe=np.maximum(z,.001);u=local[:,:,0]/safe*c['focal']+c['ppx'];v=local[:,:,1]/safe*c['focal']+c['ppy']
        edge=np.minimum.reduce([u/720,1-u/720,v/1280,1-v/1280]);score=np.maximum(edge,0)*np.maximum(z,0)**2
        return u.astype(np.float32),v.astype(np.float32),score
    thumbs=[];scores=[]
    for c,im in zip(cameras,images):
        u,v,score=warp(c,small);thumbs.append(cv2.remap(im,u,v,cv2.INTER_LINEAR));scores.append(score)
    # Solve gentle per-channel exposure gains from agreeing overlaps. No sky
    # replacement, content warps, or separate near/far camera registrations.
    rows=[];targets=[]
    for i in range(len(cameras)):
        for j in range(max(0,i-3),i):
            mask=(scores[i]>.025)&(scores[j]>.025)&(thumbs[i].min(2)>18)&(thumbs[j].min(2)>18)&(thumbs[i].max(2)<245)&(thumbs[j].max(2)<245)
            if mask.sum()<120:continue
            a=thumbs[i][mask].astype(float);b=thumbs[j][mask].astype(float);ratio=np.median(np.log((b+1)/(a+1)),axis=0)
            row=np.zeros(len(cameras));row[i]=1;row[j]=-1;rows.append(row);targets.append(ratio)
    row=np.zeros(len(cameras));row[cameras.index(anchor)]=5;rows.append(row);targets.append(np.zeros(3));gains=np.clip(np.exp(np.linalg.lstsq(np.array(rows),np.array(targets),rcond=None)[0]),.78,1.28)
    cropped=[];masks=[];corners=[];indices=[]
    for i,(thumb,score) in enumerate(zip(thumbs,scores)):
        mask=(score>.002).astype(np.uint8)*255;y,x=np.where(mask)
        if not len(x):continue
        x0,x1,y0,y1=int(x.min()),int(x.max()+1),int(y.min()),int(y.max()+1)
        corrected=np.clip(thumb.astype(np.float32)*gains[i],0,255).astype(np.float32);cropped.append(corrected[y0:y1,x0:x1].copy());masks.append(mask[y0:y1,x0:x1].copy());corners.append((x0,y0));indices.append(i)
    optimized=cv2.detail_GraphCutSeamFinder('COST_COLOR_GRAD').find(cropped,corners,masks);seams={}
    for i,mask,(x,y) in zip(indices,optimized,corners):
        mask=mask.get();full=np.zeros((sh,sw),np.uint8);full[y:y+mask.shape[0],x:x+mask.shape[1]]=mask;seams[i]=full
    del cropped,masks,thumbs,scores,optimized,small;gc.collect();print('OFFICE_SEAMS',len(seams),flush=True)
    blender=cv2.detail_MultiBandBlender();blender.setNumBands(6);blender.prepare((0,0,width,height))
    for i,(c,im) in enumerate(zip(cameras,images)):
        if i not in seams:continue
        u,v,score=warp(c,directions);mask=cv2.resize(seams[i],(width,height),interpolation=cv2.INTER_NEAREST);mask[score<=0]=0
        color=cv2.remap(im,u,v,cv2.INTER_LINEAR);color=np.clip(color.astype(np.float32)*gains[i],0,255).astype(np.int16);blender.feed(color,mask,(0,0));print('OFFICE_BLEND',i,flush=True)
    result,resultmask=blender.blend(None,None);image=np.clip(result,0,255).astype(np.uint8);valid=(resultmask>0).astype(np.uint8)
    cv2.imwrite(str(CACHE/'photographic.png'),image)
    edit=cv2.cvtColor(image,cv2.COLOR_BGR2BGRA);edit[:,:,3]=valid*255;cv2.imwrite(str(CACHE/'outpaint-input.png'),edit)
    # Unrecorded directions use a quiet sky/ground color continuation, never
    # stretched edge pixels, repeated houses, or invented fence geometry.
    known=[];samples=[]
    for y in range(height):
        if valid[y].sum()>30:known.append(y);samples.append(np.median(image[y][valid[y]>0],axis=0))
    profile=np.stack([np.interp(np.arange(height),known,np.array(samples)[:,k]) for k in range(3)],axis=1).astype(np.float32);profile=cv2.GaussianBlur(profile,(1,65),0)
    sky=np.median(images[cameras.index(anchor)][:190,170:550],axis=(0,1)).astype(np.float32)
    sky_weight=np.clip((height*.54-np.arange(height))/(height*.12),0,1)[:,None]
    profile=profile*(1-sky_weight)+sky[None,:]*sky_weight
    extension=BASE/'margins-outpaint.png';fill=np.broadcast_to(profile[:,None,:],image.shape)
    if extension.exists():fill=cv2.resize(cv2.imread(str(extension)),(width,height),interpolation=cv2.INTER_CUBIC)
    alpha=np.clip(cv2.distanceTransform(valid,cv2.DIST_L2,5)/16,0,1)[:,:,None]
    image=np.clip(image*alpha+fill*(1-alpha),0,255).astype(np.uint8)
    cv2.imwrite(str(BASE/'panorama-day.jpg'),image,[cv2.IMWRITE_JPEG_QUALITY,94]);cv2.imwrite(str(CACHE/'coverage.png'),valid*255);cv2.imwrite(str(CACHE/'panorama-preview.jpg'),cv2.resize(image,(2048,1024)))
    headings=np.unwrap([np.arctan2(c['rotation'][0][2],c['rotation'][2][2]) for c in cameras]);hfov=np.arctan(360/cameras[0]['focal'])
    manifest=dict(sourceVideo='IMG_7622.MOV',frames=len(cameras),width=width,height=height,focalPixels=cameras[0]['focal'],anchorTimeSeconds=anchor['time'],radiusMeters=10,originInches=[44,63,66.5],capturedYawDegrees=[float(np.degrees(headings.min()-anchor_yaw-hfov)),float(np.degrees(headings.max()-anchor_yaw+hfov))],uncapturedFill='soft sky/ground colors; no stretched image borders',image='panorama-day.jpg')
    if extension.exists():manifest.update(uncapturedFill='AI-assisted sky/ground/foliage continuation outside the captured mask',marginAsset=extension.name,photographicInteriorPreserved=True)
    (BASE/'manifest.json').write_text(json.dumps(manifest,indent=2));print('OFFICE_PANORAMA_COMPLETE',json.dumps(manifest),flush=True)

if __name__=='__main__':panorama()
