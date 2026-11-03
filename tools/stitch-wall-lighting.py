"""Smooth satin-wall irradiance in world space across separate UV charts.

Original eight-foot walls and their vaulted extensions are separate meshes.
Filtering their charts independently can leave a horizontal lighting step.
Reconstruct a common irradiance field for coplanar painted wall faces, then
sample it back into each atlas. Geometry, albedo and surface normals stay intact.
"""
from pathlib import Path
import json
import cv2,numpy as np

ROOT=Path(__file__).resolve().parents[1];SIZE=2048;CELL=.015
source=json.loads((ROOT/'previews/blender-scene.json').read_text())
records={r['id']:r for r in json.loads((ROOT/'Textures/Lighting/manifest.json').read_text())['records']}
uv=np.fromfile(ROOT/'Textures/Lighting/room-uv.bin',np.float32).reshape(-1,2)
groups={}
for data in source['meshes']:
    if abs(data['roughness']-.42)>.001:continue
    p=np.asarray(data['positions']).reshape(-1,3);indices=np.asarray(data['indices'] or list(range(len(p)))).reshape(-1,3)
    record=records[data['id']];faceuv=uv[record['offset']:record['offset']+record['count']].reshape(-1,3,2)
    for positions,coords in zip(p[indices],faceuv):
        normal=np.cross(positions[1]-positions[0],positions[2]-positions[0]);area=np.linalg.norm(normal)
        if area<1e-8:continue
        normal/=area;axis=int(np.argmax(np.abs(normal)))
        if axis==1 or abs(normal[axis])<.99999:continue
        key=(axis,int(np.sign(normal[axis])),round(float(positions[:,axis].mean()),3))
        pixels=coords*SIZE-.5;x0=max(0,int(np.floor(pixels[:,0].min())));x1=min(SIZE-1,int(np.ceil(pixels[:,0].max())));y0=max(0,int(np.floor(pixels[:,1].min())));y1=min(SIZE-1,int(np.ceil(pixels[:,1].max())))
        if x1<x0 or y1<y0:continue
        yy,xx=np.mgrid[y0:y1+1,x0:x1+1];a=pixels[1]-pixels[0];b=pixels[2]-pixels[0];det=a[0]*b[1]-a[1]*b[0]
        if abs(det)<1e-8:continue
        dx=xx-pixels[0,0];dy=yy-pixels[0,1];u=(dx*b[1]-dy*b[0])/det;v=(a[0]*dy-a[1]*dx)/det
        mask=np.zeros(xx.shape,dtype=np.uint8);cv2.fillConvexPoly(mask,np.rint(pixels-[x0,y0]).astype(np.int32),1);mask=mask>0
        if not mask.any():continue
        bary=np.maximum(np.stack((1-u[mask]-v[mask],u[mask],v[mask]),axis=1),0);bary/=bary.sum(axis=1,keepdims=True)
        world=bary@positions;axes=[k for k in range(3) if k!=axis]
        groups.setdefault(key,[]).append((xx[mask],yy[mask],world[:,axes]))

groups={key:tuple(np.concatenate([p[k] for p in patches]) for k in range(3)) for key,patches in groups.items()}
print('WORLD_WALL_FIELDS',len(groups),flush=True)
for mode in ['day','night']:
    path=ROOT/'Textures/Lighting'/f'room-{mode}.hdr';image=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)[::-1,:,::-1].copy();output=image.copy()
    for key,(xx,yy,world) in groups.items():
        if len(xx)<256:continue
        origin=world.min(axis=0)-CELL*10;grid=(world-origin)/CELL;ij=np.rint(grid).astype(np.int32);width,height=ij.max(axis=0)+11
        field=np.zeros((height,width,3),np.float32);weights=np.zeros((height,width),np.float32)
        np.add.at(field,(ij[:,1],ij[:,0]),image[yy,xx]);np.add.at(weights,(ij[:,1],ij[:,0]),1)
        valid=weights>0;field[valid]/=weights[valid,None]
        _,nearest=cv2.distanceTransformWithLabels((~valid).astype(np.uint8),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL);locations=np.argwhere(valid)
        field=field[locations[nearest-1,0],locations[nearest-1,1]]
        sigma=(.07 if mode=='night' else .025)/CELL;field=cv2.GaussianBlur(field,(0,0),sigmaX=sigma,sigmaY=sigma)
        # The concave hallway corner was reading as a dark vertical beam.
        # Bound its contact contrast against the same wall just beyond the
        # corner; retain a small, smoothly fading occlusion at the actual join.
        corner_axis=None
        if key[0]==0 and key[1]==-1 and abs(key[2]-124*.0254)<.002:corner_axis=1;corner_value=120*.0254
        if key[0]==2 and key[1]==-1 and abs(key[2]-120*.0254)<.002:corner_axis=0;corner_value=124*.0254
        if corner_axis is not None:
            distance=world[:,corner_axis]-corner_value;near=(distance>=-.005)&(distance<.23)
            if near.any():
                reference=grid.copy();reference[:,corner_axis]=(corner_value+.25-origin[corner_axis])/CELL
                ref=cv2.remap(field,reference[:,0].astype(np.float32).reshape(-1,1),reference[:,1].astype(np.float32).reshape(-1,1),cv2.INTER_LINEAR).reshape(-1,3)
                sampled=cv2.remap(field,grid[:,0].astype(np.float32).reshape(-1,1),grid[:,1].astype(np.float32).reshape(-1,1),cv2.INTER_LINEAR).reshape(-1,3)
                strength=np.exp(-(distance[near]/.14)**2)[:,None];floor=ref[near]*(.86 if mode=='day' else .72)
                lifted=np.maximum(sampled[near],floor);sampled[near]=sampled[near]*(1-strength)+lifted*strength
                output[yy,xx]=sampled;continue
        sampled=cv2.remap(field,grid[:,0].astype(np.float32).reshape(-1,1),grid[:,1].astype(np.float32).reshape(-1,1),cv2.INTER_LINEAR).reshape(-1,3)
        output[yy,xx]=sampled
    for suffix,size in [('',2048),('-mobile',1024)]:
        data=output if size==2048 else cv2.resize(output,(size,size),interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(ROOT/'Textures/Lighting'/f'room-{mode}{suffix}.hdr'),data[::-1,:,::-1])
    print('WALL_STITCH_COMPLETE',mode,flush=True)
