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
        new.append(dict(image=str(path),width=720,height=1280,ppx=360,ppy=640,focal=1095.0))
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
            if j<nold:
                H,mask=cv2.findHomography(pa,pb,cv2.RANSAC,5)
                if mask is None or mask.sum()<25:continue
                def K(c):return np.array([[c['focal'],0,c['ppx']],[0,c['focal'],c['ppy']],[0,0,1.]])
                A=np.linalg.inv(K(allc[j]))@H@K(allc[i]);u,sv,v=np.linalg.svd(A)
                if sv[-1]<1e-8 or sv[0]/sv[-1]>1.5:continue
                R=u@v
                if np.linalg.det(R)<0:R=-R
                # Earlier cameras have different intrinsics and parallax.
                # They anchor global placement, while the new sweep's own
                # measured lens and relative rotations determine its geometry.
                edges.append((i,j,R,float(mask.sum())*.1));continue
            a,b=rays(pa,allc[i]),rays(pb,allc[j]);best=np.zeros(len(a),bool)
            for _ in range(180):
                ix=rng.choice(len(a),3,replace=False);R=fit(a[ix],b[ix]);mask=np.sum((a@R.T)*b,axis=1)>np.cos(np.deg2rad(.8))
                if mask.sum()>best.sum():best=mask
            if best.sum()<25 or best.mean()<.35:continue
            R=fit(a[best],b[best]);err=np.rad2deg(np.arccos(np.clip(np.sum((a@R.T)*b,axis=1),-1,1)));mask=err<.8
            R=fit(a[mask],b[mask]);weight=float(mask.sum());edges.append((i,j,R,weight))
        print('REGISTER',i-nold,'edges',len(edges),flush=True)
    anchors=[e for e in edges if e[1]<nold]
    relative=[e for e in edges if e[1]>=nold]
    seed=max(anchors,key=lambda e:e[3]);seed_id=seed[0]
    poses={seed_id:np.array(old[seed[1]]['rotation'])@seed[2]}
    # Build one coherent sweep before anchoring it. Independently seeding each
    # frame from a noisy old/new match can put rotation averaging in a flipped
    # local minimum. Only reliable within-sweep ray matches set its shape.
    while True:
        choices=[]
        for i,j,R,w in relative:
            if j in poses and i not in poses:choices.append((w,i,poses[j]@R))
            if i in poses and j not in poses:choices.append((w,j,poses[i]@R.T))
        if not choices:break
        w,i,R=max(choices,key=lambda e:e[0]);poses[i]=R
    for _ in range(100):
        updates={}
        for i in poses:
            if i==seed_id:continue
            candidates=[]
            for a,b,R,w in relative:
                if a==i and b in poses:candidates.append((poses[b]@R,w))
                elif b==i and a in poses:candidates.append((poses[a]@R.T,w))
            matrix=np.zeros((3,3))
            for target,w in candidates:
                angle=np.arccos(np.clip((np.trace(poses[i].T@target)-1)/2,-1,1));matrix+=target*w*min(1,.025/max(angle,1e-6))
            u,_,v=np.linalg.svd(matrix);updates[i]=u@v
        poses.update(updates)
    global_candidates=[(np.array(old[j]['rotation'])@R@poses[i].T,w) for i,j,R,w in anchors if i in poses]
    def angle(A,B):return np.arccos(np.clip((np.trace(A.T@B)-1)/2,-1,1))
    center=min(global_candidates,key=lambda a:sum(min(angle(a[0],b[0]),.25)*b[1] for b in global_candidates))[0]
    matrix=sum(R*w for R,w in global_candidates if angle(center,R)<.15)
    u,_,v=np.linalg.svd(matrix);global_rotation=u@v
    poses={i:global_rotation@R for i,R in poses.items()}
    result=[]
    for i,c in enumerate(new,nold):
        if i not in poses:continue
        c['rotation']=poses[i].tolist();result.append(c)
    (CACHE/'registered-f1095-checked.json').write_text(json.dumps(result));return result

def replace_sky(image,profile):
    # Segment connected sky rather than thresholding every blue/white pixel.
    # Color-only correction erased pale branches and the tops of white houses.
    h,w=image.shape[:2];small=cv2.resize(image,(1024,512));color=small.astype(np.float32);y=np.arange(512)[:,None]/512
    b,g,r=color[:,:,0],color[:,:,1],color[:,:,2]
    mask=np.full((512,1024),cv2.GC_PR_BGD,np.uint8)
    vegetation=(r>b*1.08)|(g>b*1.08)|((b<110)&(b-g<15)&(b-r<15))
    mask[vegetation]=cv2.GC_PR_FGD
    mask[(b-r>60)&(b-g>30)&(y<.49)]=cv2.GC_BGD
    mask[(np.minimum.reduce([b,g,r])>235)&(y<.47)]=cv2.GC_BGD
    mask[np.broadcast_to(y<.31,mask.shape)]=cv2.GC_BGD
    mask[np.broadcast_to(y>.515,mask.shape)]=cv2.GC_FGD
    bg=np.zeros((1,65),np.float64);fg=np.zeros((1,65),np.float64);cv2.grabCut(small,mask,None,bg,fg,5,cv2.GC_INIT_WITH_MASK)
    sky=((mask==cv2.GC_BGD)|(mask==cv2.GC_PR_BGD)).astype(np.float32)
    alpha=cv2.GaussianBlur(cv2.resize(sky,(w,h)),(0,0),.6)
    result=np.clip(image*(1-alpha[:,:,None])+profile[:,None,:]*alpha[:,:,None],0,255).astype(np.uint8)
    cv2.imwrite(str(CACHE/'sky-mask.png'),(alpha*255).astype(np.uint8))
    return result

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
        if 'planeToReference' in c:
            refu,refv=u.copy(),v.copy();H=np.linalg.inv(np.array(c['planeToReference'],np.float32))
            den=H[2,0]*refu+H[2,1]*refv+H[2,2]
            u=(H[0,0]*refu+H[0,1]*refv+H[0,2])/np.maximum(den,.001);v=(H[1,0]*refu+H[1,1]*refv+H[1,2])/np.maximum(den,.001)
        edge=np.minimum(u/c['width'],1-u/c['width']);edge=np.minimum(edge,v/c['height']);edge=np.minimum(edge,1-v/c['height'])
        if c['image']=='front.jpg':edge=np.minimum(edge,(.82-v/c['height']))
        if c['image']=='view-08.jpg' and not night:
            edge[(u>570)&(v>600-(u-600)*1.4)&(v<705)]=0
        score=np.maximum(edge,0)*np.maximum(z,0)**2
        if 'planeToReference' in c:score*=(refu>705)&(refv>680)&(refv<1200)&(theta>0)&(theta<1.4)
        if c['image'] in ['front.jpg','water.jpg']:score*=3
        if Path(c['image']).is_absolute():score*=.8
        return u.astype(np.float32),v.astype(np.float32),score
    # Find seams through agreeing image regions, rather than switching at an
    # arbitrary camera-center boundary (which can cut branches in half).
    thumbnails=[];masks=[];corners=[];seam_indices=[];sw,sh=width//8,height//8;core=np.full((sh,sw),-1,np.int16)
    original_coverage=np.zeros((sh,sw),bool);primary_coverage=np.zeros((sh,sw),bool)
    for i,c in enumerate(cameras):
        u,v,score=warp(c)
        if c.get('primary'):primary_coverage|=cv2.resize(score,(sw,sh))>.01
        if not Path(c['image']).is_absolute():original_coverage|=cv2.resize(score,(sw,sh))>.015
        if c['image'] in ['front.jpg','water.jpg']:
            core[cv2.resize(score,(sw,sh))>.025]=i
    for i,c in enumerate(cameras):
        u,v,score=warp(c);path=Path(c['image']) if Path(c['image']).is_absolute() else BASE/('Night' if night else '')/c['image']
        im=cv2.imread(str(path));color=cv2.remap(im,cv2.resize(u,(sw,sh)),cv2.resize(v,(sw,sh)),cv2.INTER_LINEAR)
        mask=(cv2.resize(score,(sw,sh))>.002)&((core<0)|(core==i))
        if not c.get('primary'):mask&=~primary_coverage
        if Path(c['image']).is_absolute() and not c.get('primary'):mask&=~original_coverage
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
        if 'colorGain' in c:color=np.clip(color.astype(np.float32)*np.array(c['colorGain'],np.float32),0,255).astype(np.uint8)
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
            cv2.imwrite(str(CACHE/'stitched-raw-day.jpg'),image,[cv2.IMWRITE_JPEG_QUALITY,97])
            (CACHE/'sky-profile.json').write_text(json.dumps(profile.tolist()))
            image=replace_sky(image,profile)
    name='panorama-night.jpg' if night else 'panorama-day.jpg';cv2.imwrite(str(BASE/name),image,[cv2.IMWRITE_JPEG_QUALITY,94])
    cv2.imwrite(str(CACHE/('night-coverage.png' if night else 'day-coverage.png')),valid.astype(np.uint8)*255)
    print('PANORAMA',name,'captured',round(valid.mean()*100,1),'percent',flush=True)

old=json.loads((BASE/'cameras.json').read_text())
if __name__=='__main__':
    registered=CACHE/'registered-f1095-checked.json';new=json.loads(registered.read_text()) if registered.exists() else calibrate(old)
    # Keep angularly distinct captures; redundant frames increase seam cost
    # without adding coverage. Registration still uses the entire sequence.
    selected=[];remaining=list(new);directions=[np.array(c['rotation'])[:,2] for c in old]
    while remaining and len(selected)<32:
        c=max(remaining,key=lambda c:min(1-float(np.dot(np.array(c['rotation'])[:,2],d)) for d in directions));remaining.remove(c);selected.append(c);directions.append(np.array(c['rotation'])[:,2])
    # Keep original captured regions fixed, including the close porch roof.
    # Added footage extends those regions instead of replacing their objects.
    # Extend the brown facade in its original reference view. One facade-plane
    # transform keeps the windows, eaves and deck straight instead of joining
    # independently rotated frames through the middle of the building.
    finder=cv2.SIFT_create(nfeatures=5000);matcher=cv2.BFMatcher();features=[]
    for frame in [20,22]:
        image=cv2.imread(str(CACHE/f'frame-{frame:02}.jpg'),0);key,desc=finder.detectAndCompute(cv2.createCLAHE(2,(8,8)).apply(image),None);features.append((np.array([k.pt for k in key]),desc))
    pairs=matcher.knnMatch(features[1][1],features[0][1],k=2);good=[p for p,q in pairs if p.distance<.72*q.distance]
    a=features[1][0][[p.queryIdx for p in good]];b=features[0][0][[p.trainIdx for p in good]];keep=(a[:,1]>350)&(a[:,1]<850)&(b[:,1]<550)
    relative,mask=cv2.findHomography(a[keep],b[keep],cv2.RANSAC,2.5)
    src=np.array([[453,160],[526,158],[525,235],[454,235]],np.float32);dst=np.array([[594,850],[670,850],[670,905],[594,905]],np.float32)
    affine=np.linalg.lstsq(np.column_stack((src,np.ones(4))),dst,rcond=None)[0].T;reference=np.eye(3);reference[:2]=affine
    sy,sx=np.mgrid[735:795,580:700];points=cv2.perspectiveTransform(np.stack((sx,sy),axis=-1).astype(np.float32).reshape(1,-1,2),np.linalg.inv(reference))[0]
    source=cv2.imread(str(CACHE/'frame-20.jpg'));sample=cv2.remap(source,points[:,0].reshape(sx.shape),points[:,1].reshape(sx.shape),cv2.INTER_LINEAR)
    original=cv2.imread(str(BASE/'view-08.jpg'))[735:795,580:700];gain=np.clip(np.median(original,axis=(0,1))/np.maximum(np.median(sample,axis=(0,1)),1),.5,2)
    planes=[]
    for frame,H in [(20,reference),(22,reference@relative)]:
        c=dict(old[8]);c.update(image=str(CACHE/f'frame-{frame:02}.jpg'),width=720,height=1280,primary=True,planeToReference=H.tolist(),colorGain=gain.tolist());planes.append(c)
    panorama(old+selected+planes)
    panorama(json.loads((BASE/'Night/cameras.json').read_text()),True)
