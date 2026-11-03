"""Build one fixed, spherical exterior texture, with angular registration checks.

No runtime photo patches or clamped camera projections. Original camera poses
anchor the house/water directions; new video rotations are fitted from matched
unit rays with RANSAC and a jointly constrained rotation graph.
"""
from pathlib import Path
import json,cv2,numpy as np
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'Images/Exterior';CACHE=ROOT/'previews/exterior-stitch';CACHE.mkdir(exist_ok=True)
rng=np.random.default_rng(7)

def fit(a,b):
    u,_,v=np.linalg.svd(b.T@a);d=np.eye(3);d[2,2]=np.linalg.det(u@v);return u@d@v

def rays(points,c):
    a=np.column_stack(((points[:,0]-c['ppx'])/c['focal'],(points[:,1]-c['ppy'])/c['focal'],np.ones(len(points))))
    return a/np.linalg.norm(a,axis=1)[:,None]

def calibrate(old):
    video=cv2.VideoCapture(r'C:\Users\mattl\Downloads\IMG_7590.MOV');new=[]
    for i,frame in enumerate(range(0,935,15)):
        video.set(1,frame);ok,im=video.read()
        if not ok:continue
        path=CACHE/f'frame-{i:02}.jpg';cv2.imwrite(str(path),im)
        new.append(dict(image=str(path),width=720,height=1280,ppx=360,ppy=640,focal=879.0))
    video.release();allc=old+new;features=[];sift=cv2.SIFT_create(nfeatures=3000)
    for c in allc:
        im=cv2.imread(str(BASE/c['image']) if not Path(c['image']).is_absolute() else c['image']);scale=720/im.shape[0]
        k,d=sift.detectAndCompute(cv2.resize(im,None,fx=scale,fy=scale),None);features.append((np.array([p.pt for p in k])/scale,d))
    edges=[];bf=cv2.BFMatcher();nold=len(old)
    for i in range(nold,len(allc)):
        for j in range(i):
            if j>=nold and abs(i-j)>3 and (i-j)%8:continue
            pair=bf.knnMatch(features[i][1],features[j][1],k=2);good=[p for p,q in pair if p.distance<.68*q.distance]
            if len(good)<25:continue
            pa=features[i][0][[p.queryIdx for p in good]];pb=features[j][0][[p.trainIdx for p in good]]
            a,b=rays(pa,allc[i]),rays(pb,allc[j]);best=np.zeros(len(a),bool)
            for _ in range(180):
                ix=rng.choice(len(a),3,replace=False);R=fit(a[ix],b[ix]);mask=np.sum((a@R.T)*b,axis=1)>np.cos(np.deg2rad(.8))
                if mask.sum()>best.sum():best=mask
            if best.sum()<25 or best.mean()<.35:continue
            R=fit(a[best],b[best]);err=np.rad2deg(np.arccos(np.clip(np.sum((a@R.T)*b,axis=1),-1,1)));mask=err<.8
            R=fit(a[mask],b[mask]);weight=float(mask.sum());edges.append((i,j,R,weight))
        print('REGISTER',i-nold,'edges',len(edges),flush=True)
    poses={i:np.array(c['rotation']) for i,c in enumerate(old)}
    for _ in range(len(new)):
        choices={}
        for i,j,R,w in edges:
            if j in poses and i not in poses:choices.setdefault(i,[]).append((w,poses[j]@R))
            if i in poses and j not in poses:choices.setdefault(j,[]).append((w,poses[i]@R.T))
        if not choices:break
        for i,options in choices.items():poses[i]=max(options,key=lambda x:x[0])[1]
    # Robust rotation averaging with fixed original anchors. Reject inconsistent
    # graph edges rather than letting an isolated bad homography flip a frame.
    for _ in range(80):
        updates={}
        for i in range(nold,len(allc)):
            if i not in poses:continue
            candidates=[]
            for a,b,R,w in edges:
                if a==i and b in poses:candidates.append((poses[b]@R,w))
                elif b==i and a in poses:candidates.append((poses[a]@R.T,w))
            matrix=np.zeros((3,3))
            for target,w in candidates:
                angle=np.arccos(np.clip((np.trace(poses[i].T@target)-1)/2,-1,1));matrix+=target*w*min(1,.025/max(angle,1e-6))
            u,_,v=np.linalg.svd(matrix);updates[i]=u@v
        poses.update(updates)
    result=[]
    for i,c in enumerate(new,nold):
        if i not in poses:continue
        c['rotation']=poses[i].tolist();result.append(c)
    (CACHE/'registered.json').write_text(json.dumps(result));return result

def panorama(cameras,night=False):
    width,height=4096,2048
    anchor=json.loads((BASE/('Night/cameras.json' if night else 'cameras.json')).read_text())
    water=anchor[5] if night else next(c for c in anchor if c['image']=='water.jpg');front=anchor[0] if night else next(c for c in anchor if c['image']=='front.jpg')
    heading=lambda c:np.arctan2(c['rotation'][0][2],c['rotation'][2][2])
    north=heading(water);scale=(np.pi/2)/(north-heading(front))
    yy=np.arange(height,dtype=np.float32)[:,None];xx=np.arange(width,dtype=np.float32)[None,:]
    theta=(xx/(width-1)*2-1)*np.pi;elev=(.5-yy/(height-1))*np.pi
    yaw=theta/scale+north
    directions=np.empty((height,width,3),np.float32);directions[:,:,0]=np.sin(yaw)*np.cos(elev);directions[:,:,1]=-np.sin(elev)-( .075*np.cos(elev) if night else 0);directions[:,:,2]=np.cos(yaw)*np.cos(elev)
    # Score in source-camera space; invalid projections are never sampled.
    def warp(c):
        r=np.array(c['rotation'],np.float32);local=directions@r;z=local[:,:,2];safe=np.maximum(z,.001)
        u=local[:,:,0]/safe*c['focal']+c['ppx'];v=local[:,:,1]/safe*c['focal']+c['ppy']
        edge=np.minimum(u/c['width'],1-u/c['width']);edge=np.minimum(edge,v/c['height']);edge=np.minimum(edge,1-v/c['height'])
        if c['image']=='front.jpg':edge=np.minimum(edge,(.82-v/c['height']))
        score=np.maximum(edge,0)*np.maximum(z,0)**2
        if c['image'] in ['front.jpg','water.jpg']:score*=3
        if Path(c['image']).is_absolute():score*=.8
        return u.astype(np.float32),v.astype(np.float32),score
    # Find seams through agreeing image regions, rather than switching at an
    # arbitrary camera-center boundary (which can cut branches in half).
    thumbnails=[];masks=[];corners=[];seam_indices=[];sw,sh=width//8,height//8;core=np.full((sh,sw),-1,np.int16)
    for i,c in enumerate(cameras):
        u,v,score=warp(c)
        if c['image'] in ['front.jpg','water.jpg']:
            core[cv2.resize(score,(sw,sh))>.44]=i
    for i,c in enumerate(cameras):
        u,v,score=warp(c);path=Path(c['image']) if Path(c['image']).is_absolute() else BASE/('Night' if night else '')/c['image']
        im=cv2.imread(str(path));color=cv2.remap(im,cv2.resize(u,(sw,sh)),cv2.resize(v,(sw,sh)),cv2.INTER_LINEAR)
        mask=(cv2.resize(score,(sw,sh))>.002)&((core<0)|(core==i))
        my,mx=np.where(mask)
        if not len(mx):continue
        x0,x1,y0,y1=mx.min(),mx.max()+1,my.min(),my.max()+1
        thumbnails.append(color[y0:y1,x0:x1].astype(np.float32));masks.append(mask[y0:y1,x0:x1].astype(np.uint8)*255);corners.append((int(x0),int(y0)));seam_indices.append(i)
    optimized=cv2.detail_GraphCutSeamFinder('COST_COLOR_GRAD').find(thumbnails,corners,masks);seams={}
    for i,mask,(x,y) in zip(seam_indices,optimized,corners):
        mask=mask.get();canvas=np.zeros((sh,sw),np.uint8);canvas[y:y+mask.shape[0],x:x+mask.shape[1]]=mask;seams[i]=canvas
    np.savez_compressed(CACHE/('seams-night.npz' if night else 'seams-day.npz'),**{str(i):m for i,m in seams.items()})
    del thumbnails,masks,optimized,core,u,v,score,color
    print('SEAMS',len(seams),'night',night,flush=True)
    # Blend spatial frequencies separately: retain sharp photographic detail,
    # while spreading exposure changes across a broad, smooth transition.
    blender=cv2.detail_MultiBandBlender();blender.setNumBands(7);blender.prepare((0,0,width,height))
    for i,c in enumerate(cameras):
        if i not in seams:continue
        mask=cv2.resize(seams[i],(width,height),interpolation=cv2.INTER_NEAREST)
        if not mask.any():continue
        u,v,score=warp(c);mask[score<=0]=0
        path=Path(c['image']) if Path(c['image']).is_absolute() else BASE/('Night' if night else '')/c['image']
        im=cv2.imread(str(path));color=cv2.remap(im,u,v,cv2.INTER_LINEAR,borderMode=cv2.BORDER_CONSTANT)
        blender.feed(color.astype(np.int16),mask,(0,0))
    result,resultmask=blender.blend(None,None);valid=resultmask>0;image=np.clip(result,0,255).astype(np.uint8)
    # Unknown directions get a soft continuation of nearby photographic colors,
    # not stretched scanlines or an invalid projection of a roof into the sky.
    missing=(~valid).astype(np.uint8);_,labels=cv2.distanceTransformWithLabels(missing,cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL);pixels=image[valid];fill=pixels[labels-1];fill=cv2.GaussianBlur(fill,(0,0),28)
    image[~valid]=fill[~valid]
    if not night:
        # The phone changed exposure while tilting from sky to lawn. Normalize
        # clear-blue sky to the original water photo's smooth elevation profile;
        # retain actual clouds and foliage instead of exposing camera-shaped
        # blocks in an otherwise featureless blue sky.
        u,v,score=warp(water);reference=cv2.remap(cv2.imread(str(BASE/water['image'])),u,v,cv2.INTER_LINEAR)
        sky=(reference[:,:,0]>reference[:,:,2]*1.18)&(reference[:,:,0]>reference[:,:,1]*1.06)&(score>.05)&(yy<height*.47)
        rows=np.where(sky.sum(axis=1)>20)[0];samples=np.array([np.median(reference[y][sky[y]],axis=0) for y in rows])
        if len(rows)>10:
            profile=np.stack([np.polyval(np.polyfit(rows/height,samples[:,channel],2),np.clip(np.arange(height)/height,rows.min()/height,rows.max()/height)) for channel in range(3)],axis=1)
            blue=(image[:,:,0]>image[:,:,2]*1.16)&(image[:,:,0]>image[:,:,1]*1.055)&(yy<height*.47)
            alpha=cv2.GaussianBlur(blue.astype(np.float32),(0,0),1.2);alpha[~valid&(yy<height*.45)]=1
            image=np.clip(image*(1-alpha[:,:,None])+profile[:,None,:]*alpha[:,:,None],0,255).astype(np.uint8)
    name='panorama-night.jpg' if night else 'panorama-day.jpg';cv2.imwrite(str(BASE/name),image,[cv2.IMWRITE_JPEG_QUALITY,94])
    cv2.imwrite(str(CACHE/('night-coverage.png' if night else 'day-coverage.png')),valid.astype(np.uint8)*255)
    print('PANORAMA',name,'captured',round(valid.mean()*100,1),'percent',flush=True)

old=json.loads((BASE/'cameras.json').read_text())
if __name__=='__main__':
    registered=CACHE/'registered.json';new=json.loads(registered.read_text()) if registered.exists() else calibrate(old)
    # Keep angularly distinct captures; redundant frames increase seam cost
    # without adding coverage. Registration still uses the entire sequence.
    selected=[];remaining=list(new);directions=[np.array(c['rotation'])[:,2] for c in old]
    while remaining and len(selected)<32:
        c=max(remaining,key=lambda c:min(1-float(np.dot(np.array(c['rotation'])[:,2],d)) for d in directions));remaining.remove(c);selected.append(c);directions.append(np.array(c['rotation'])[:,2])
    # Use a single daytime sweep for nearby trees/roofs. The earlier front
    # photo was taken from a different camera position, so blending its canopy
    # with the new sweep creates double branches even with correct rotations.
    # Its pose still anchors registration; the distant water still can safely
    # supply higher resolution without that near-field parallax.
    panorama([next(c for c in old if c['image']=='water.jpg')]+selected)
    panorama(json.loads((BASE/'Night/cameras.json').read_text()),True)
