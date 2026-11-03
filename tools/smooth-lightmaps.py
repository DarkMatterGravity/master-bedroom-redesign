"""Denoise within UV charts, never across unrelated packed surfaces.

The original raw Cycles buffers are linear, bottom-up float arrays. Outside
each chart, nearest valid radiance supplies the denoiser's context; only that
chart and its empty gutter are written back. This prevents atlas neighbors
from creating blotches or triangle-shaped changes on otherwise flat walls.
"""
from pathlib import Path
import importlib.util
import sys
import cv2,numpy as np

ROOT=Path(__file__).resolve().parents[1];SIZE=2048
spec=importlib.util.spec_from_file_location('denoise',str(Path(__file__).with_name('denoise-lightmap.py')))
denoiser=importlib.util.module_from_spec(spec);spec.loader.exec_module(denoiser)
uv=np.fromfile(ROOT/'Textures/Lighting/room-uv.bin',np.float32).reshape(-1,3,2)
a,b=uv[:,1]-uv[:,0],uv[:,2]-uv[:,0]
area=np.abs(a[:,0]*b[:,1]-a[:,1]*b[:,0]);valid=np.where(area>1e-13)[0]
parent=np.arange(len(uv),dtype=np.int32)
def find(a):
    while parent[a]!=a:parent[a]=parent[parent[a]];a=parent[a]
    return int(a)
first={}
for face in valid:
    for point in uv[face]:
        u,v=np.rint(point*1e7).astype(np.int64);key=(int(u)<<32)|int(v)
        if key in first:
            a,b=find(face),find(first[key]);parent[a]=b
        else:first[key]=int(face)
roots=np.array([find(i) for i in valid]);_,groups=np.unique(roots,return_inverse=True)
labels=np.zeros((SIZE,SIZE),dtype=np.int32)
for face,group in zip(valid,groups):
    points=np.rint(uv[face]*SIZE-.5).astype(np.int32)
    cv2.fillConvexPoly(labels,points,int(group)+1)
counts=np.bincount(labels.ravel());large=np.where(counts>=16)[0];large=large[large!=0]
print('LIGHTMAP_CHARTS',len(counts)-1,'denoising',len(large),flush=True)
for mode in ['day','night']:
    raw=np.load(ROOT/'previews'/f'light-{mode}.npy');output=raw.copy()
    for index,label in enumerate(large):
        yy,xx=np.where(labels==label);y0=max(0,int(yy.min())-12);y1=min(SIZE,int(yy.max())+13);x0=max(0,int(xx.min())-12);x1=min(SIZE,int(xx.max())+13)
        mask=labels[y0:y1,x0:x1]==label;source=raw[y0:y1,x0:x1]
        _,nearest=cv2.distanceTransformWithLabels((~mask).astype(np.uint8),cv2.DIST_L2,5,labelType=cv2.DIST_LABEL_PIXEL)
        locations=np.argwhere(mask);filled=source[locations[nearest-1,0],locations[nearest-1,1]]
        clean=denoiser.denoise(filled) if counts[label]>=512 and '--polish-only' not in sys.argv else filled
        # Indirect light should vary slowly across painted surfaces. Low-pass
        # residual Monte Carlo noise inside each chart, keeping chart gutters
        # and adjacent surfaces separate. Thin trim receives a smaller radius.
        sigma=(4 if counts[label]>=512 else 1.5) if mode=='night' else .8
        clean=cv2.GaussianBlur(clean,(0,0),sigmaX=sigma,sigmaY=sigma,borderType=cv2.BORDER_REPLICATE)
        gutter=cv2.dilate(mask.astype(np.uint8),np.ones((17,17),np.uint8))>0
        write=mask|(gutter&(labels[y0:y1,x0:x1]==0));output[y0:y1,x0:x1][write]=clean[write]
        if index%250==0:print('CHART_PROGRESS',mode,index,len(large),flush=True)
    np.save(ROOT/'previews'/f'light-{mode}.npy',np.maximum(output,0));print('CHART_SMOOTH_COMPLETE',mode,flush=True)
