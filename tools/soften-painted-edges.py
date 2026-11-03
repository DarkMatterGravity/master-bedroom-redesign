"""Keep white moulding edges legible without near-black painted side faces.

Bound the darkest trim illumination against the same piece's room-facing
illumination, then rebuild atlas gutters from the current surface radiance.
Wood, cloth, artwork and the Before materials are untouched.
"""
from pathlib import Path
import json
import cv2,numpy as np
ROOT=Path(__file__).resolve().parents[1];SIZE=2048
scene=json.loads((ROOT/'previews/blender-scene.json').read_text());meta=json.loads((ROOT/'Textures/Lighting/manifest.json').read_text());records={r['id']:r for r in meta['records']}
uv=np.fromfile(ROOT/'Textures/Lighting/room-uv.bin',np.float32).reshape(-1,3,2)
valid=np.zeros((SIZE,SIZE),np.uint8)
for triangle in uv:cv2.fillConvexPoly(valid,np.rint(triangle*SIZE-.5).astype(np.int32),1)
distance,nearest=cv2.distanceTransformWithLabels(1-valid,cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL);locations=np.argwhere(valid>0);gutter=(valid==0)&(distance<=8)
pieces=[];center=np.array([62,64,100])*.0254
for data in scene['meshes']:
    if data['softgoods'] or not .54<=data['roughness']<=.61 or min(data['color'])<.5 or data['metalness']>.1:continue
    r=records[data['id']];coords=uv[r['offset']//3:(r['offset']+r['count'])//3]
    p=np.asarray(data['positions']).reshape(-1,3);indices=np.asarray(data['indices'] or list(range(len(p)))).reshape(-1,3);tri=p[indices]
    normals=np.cross(tri[:,1]-tri[:,0],tri[:,2]-tri[:,0]);toward=np.sum(normals*(center-tri.mean(axis=1)),axis=1)>0
    mask=np.zeros((SIZE,SIZE),np.uint8);front=np.zeros_like(mask)
    for t,inward in zip(coords,toward):
        pixels=np.rint(t*SIZE-.5).astype(np.int32);cv2.fillConvexPoly(mask,pixels,1)
        if inward:cv2.fillConvexPoly(front,pixels,1)
    if np.count_nonzero(front)<3:continue
    pieces.append((np.flatnonzero(mask).astype(np.int32),np.flatnonzero(front).astype(np.int32)))
print('PAINTED_EDGE_PIECES',len(pieces))
for mode in ['day','night']:
    path=ROOT/'Textures/Lighting'/f'room-{mode}.hdr';image=cv2.imread(str(path),cv2.IMREAD_UNCHANGED)[::-1,:,::-1].copy()
    flat=image.reshape(-1,3)
    for mask,front in pieces:
        values=flat[front];luma=values@np.array([.2126,.7152,.0722]);reference=float(np.percentile(luma,80));minimum=reference*(.78 if mode=='day' else .58)
        values=flat[mask];luma=values@np.array([.2126,.7152,.0722]);gain=np.maximum(1,minimum/np.maximum(luma,1e-6));values*=gain[:,None];flat[mask]=values
    idx=nearest[gutter]-1;image[gutter]=image[locations[idx,0],locations[idx,1]]
    for suffix,size in [('',2048),('-mobile',1024)]:
        data=image if size==2048 else cv2.resize(image,(size,size),interpolation=cv2.INTER_AREA)
        cv2.imwrite(str(ROOT/'Textures/Lighting'/f'room-{mode}{suffix}.hdr'),data[::-1,:,::-1])
    print('PAINTED_EDGES_SOFTENED',mode)
