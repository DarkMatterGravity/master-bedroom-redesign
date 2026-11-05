"""Register the office sweep with fixed lens intrinsics and nearby-frame matches.

Run without arguments to refit the saved source JPEGs, or pass --video to
extract the original 720x1280 MOV again. --focal is in pixels; 1004.3 was
estimated from IMG_7622.MOV. No free per-frame focal lengths or camera-plane
warps are allowed, so architecture cannot be bent to fit near-object parallax.
"""
import cv2,numpy as np,json
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1];p=ROOT/'Images/OfficeExterior';
import argparse
parser=argparse.ArgumentParser();parser.add_argument('--video');parser.add_argument('--focal',type=float,default=1004.3);args=parser.parse_args()
if args.video:
 cap=cv2.VideoCapture(args.video);duration=cap.get(cv2.CAP_PROP_FRAME_COUNT)/cap.get(cv2.CAP_PROP_FPS);records=[]
 for i,t in enumerate(np.arange(.1,duration-.2,.65)):
  cap.set(cv2.CAP_PROP_POS_MSEC,float(t*1000));ok,im=cap.read()
  if not ok:continue
  if im.shape[:2]!=(1280,720):raise RuntimeError('This calibration expects the 720-by-1280 portrait sweep')
  name=f'source-{i:02d}.jpg';cv2.imwrite(str(p/name),im,[cv2.IMWRITE_JPEG_QUALITY,96]);records.append(dict(image=name,time=float(t),focal=args.focal,ppx=360,ppy=640))
 cap.release()
else:records=json.loads((p/'cameras.json').read_text())
f=args.focal;features=[];sift=cv2.SIFT_create(nfeatures=3200);rng=np.random.default_rng(19)
for c in records:
 im=cv2.imread(str(p/c['image']));mask=np.zeros(im.shape[:2],np.uint8);mask[:int(len(im)*.8)]=255;k,d=sift.detectAndCompute(im,mask);features.append((np.array([a.pt for a in k]),d))
def rays(pts):
 q=np.column_stack(((pts[:,0]-360)/f,(pts[:,1]-640)/f,np.ones(len(pts))));return q/np.linalg.norm(q,axis=1)[:,None]
def fit(a,b):
 u,_,v=np.linalg.svd(b.T@a);t=np.eye(3);t[2,2]=np.linalg.det(u@v);return u@t@v
bf=cv2.BFMatcher();edges=[]
for i in range(1,len(records)):
 for j in range(max(0,i-3),i):
  pairs=bf.knnMatch(features[i][1],features[j][1],k=2);back=bf.match(features[j][1],features[i][1]);reverse={m.queryIdx:m.trainIdx for m in back};good=[a for a,b in pairs if a.distance<.65*b.distance and reverse.get(a.trainIdx)==a.queryIdx]
  if len(good)<25:continue
  a=rays(features[i][0][[m.queryIdx for m in good]]);b=rays(features[j][0][[m.trainIdx for m in good]]);best=np.zeros(len(a),bool)
  for _ in range(300):
   ids=rng.choice(len(a),3,replace=False);R=fit(a[ids],b[ids]);m=np.sum((a@R.T)*b,axis=1)>np.cos(np.deg2rad(.65))
   if m.sum()>best.sum():best=m
  if best.sum()<20:continue
  R=fit(a[best],b[best]);err=np.rad2deg(np.arccos(np.clip(np.sum((a@R.T)*b,axis=1),-1,1)));best=err<.65;R=fit(a[best],b[best]);yaw=np.degrees(np.arctan2(R[0,2],R[2,2]));angle=np.degrees(np.arccos(np.clip((np.trace(R)-1)/2,-1,1)))
  if abs(yaw)>35 or angle>40:continue
  edges.append((i,j,R,float(best.sum())));print('EDGE',i,j,'yaw',round(yaw,2),'inliers',int(best.sum()),'median',round(float(np.median(err[best])),3),flush=True)
poses={0:np.eye(3)}
while len(poses)<len(records):
 choices=[]
 for i,j,R,w in edges:
  if j in poses and i not in poses:choices.append((w,i,poses[j]@R))
  if i in poses and j not in poses:choices.append((w,j,poses[i]@R.T))
 if not choices:raise RuntimeError('Disconnected rotation graph')
 _,i,R=max(choices,key=lambda a:a[0]);poses[i]=R
for _ in range(100):
 updates={}
 for i in range(1,len(records)):
  candidates=[]
  for a,b,R,w in edges:
   if a==i:candidates.append((poses[b]@R,w))
   if b==i:candidates.append((poses[a]@R.T,w))
  M=np.zeros((3,3))
  for R,w in candidates:
   angle=np.arccos(np.clip((np.trace(poses[i].T@R)-1)/2,-1,1));M+=R*w*min(1,.012/max(angle,1e-6))
  u,_,v=np.linalg.svd(M);updates[i]=u@v
 poses.update(updates)
rotations=cv2.detail.waveCorrect([poses[i].astype(np.float32) for i in range(len(records))],cv2.detail.WAVE_CORRECT_HORIZ)
for i,(c,R) in enumerate(zip(records,rotations)):c.update(focal=f,rotation=R.tolist())
(p/'cameras.json').write_text(json.dumps(records));print('RESULT',[(round(c['time'],1),round(float(np.degrees(np.arctan2(c['rotation'][0][2],c['rotation'][2][2]))),1),round(float(np.degrees(np.arcsin(c['rotation'][1][2]))),1)) for c in records],flush=True)
