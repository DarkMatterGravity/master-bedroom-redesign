"""Register new footage against fixed original panorama cameras.

Existing anchors are read-only: additions cover more directions without
moving the already approved house, trees, water or city alignment.
"""
from pathlib import Path
import cv2,json,numpy as np
ROOT=Path(__file__).resolve().parents[1];BASE=ROOT/'Images/Exterior';OUT=BASE/'Extra';OUT.mkdir(exist_ok=True)
old=json.loads((BASE/'cameras.json').read_text());video=cv2.VideoCapture(r'C:\Users\mattl\Downloads\IMG_7590.MOV')
new=[];images=[]
for i,frame in enumerate([*range(0,935,15),934]):
    video.set(cv2.CAP_PROP_POS_FRAMES,frame);ok,image=video.read()
    if not ok:continue
    name=f'extra-{i:02}.jpg';cv2.imwrite(str(OUT/name),image,[cv2.IMWRITE_JPEG_QUALITY,92]);images.append(image);new.append({'image':f'Extra/{name}','width':image.shape[1],'height':image.shape[0],'ppx':image.shape[1]/2,'ppy':image.shape[0]/2})
video.release();finder=cv2.SIFT_create(nfeatures=2200);matcher=cv2.BFMatcher()
def features(image):
    scale=640/image.shape[0];small=cv2.resize(image,None,fx=scale,fy=scale);key,desc=finder.detectAndCompute(small,None);return (np.array([k.pt for k in key],np.float32),desc,scale)
oldf=[features(cv2.imread(str(BASE/c['image']))) for c in old];newf=[features(i) for i in images]
def homography(a,b):
    pairs=matcher.knnMatch(a[1],b[1],k=2);good=[p for p,q in pairs if p.distance<.72*q.distance]
    if len(good)<18:return None
    src=a[0][[p.queryIdx for p in good]];dst=b[0][[p.trainIdx for p in good]]
    H,mask=cv2.findHomography(src,dst,cv2.RANSAC,2.2)
    if H is None or int(mask.sum())<18 or mask.mean()<.25:return None
    return H,int(mask.sum())
def K(c,scale=1):return np.array([[c['focal']*scale,0,c['ppx']*scale],[0,c['focal']*scale,c['ppy']*scale],[0,0,1]])
matches=[];estimates=[]
for i,a in enumerate(newf):
    candidates=[]
    for j,b in enumerate(oldf):
        found=homography(a,b)
        if found is None:continue
        H,count=found;M=np.linalg.inv(K(old[j],b[2]))@H@np.array([[1,0,new[i]['ppx']*a[2]],[0,1,new[i]['ppy']*a[2]],[0,0,1]])
        focal=np.linalg.norm(M[:,2])/np.sqrt((np.linalg.norm(M[:,0])**2+np.linalg.norm(M[:,1])**2)/2)/a[2]
        if 350<focal<1800:candidates.append((count,j,H,focal));estimates.append(focal)
    matches.append(sorted(candidates,key=lambda x:x[0],reverse=True))
focal=float(np.median(estimates));print('EXTRA_FOCAL',focal,flush=True)
for c in new:c['focal']=focal
def rotation(H,i,j):
    A=np.linalg.inv(K(j[0],j[1]))@H@K(new[i],newf[i][2]);u,_,v=np.linalg.svd(A);R=u@v
    if np.linalg.det(R)<0:R=-R
    return R
known={}
for i,candidates in enumerate(matches):
    if candidates:
        count,j,H,_=candidates[0];known[i]=np.asarray(old[j]['rotation'])@rotation(H,i,(old[j],oldf[j][2]));print('FIXED_ANCHOR_MATCH',i,old[j]['image'],count,flush=True)
for _ in range(len(new)):
    progress=False
    for i in range(len(new)):
        if i in known:continue
        options=[]
        for j in range(max(0,i-2),min(len(new),i+3)):
            if j not in known:continue
            found=homography(newf[i],newf[j])
            if found:options.append((found[1],j,found[0]))
        if options:
            count,j,H=max(options,key=lambda x:x[0]);known[i]=known[j]@rotation(H,i,(new[j],newf[j][2]));progress=True;print('EXTENSION_MATCH',i,j,count,flush=True)
    if not progress:break
# Keep angular coverage rather than many near-duplicate frames.
angles={i:np.array([np.arctan2(r[0,2],r[2,2]),np.arcsin(np.clip(r[1,2],-1,1))]) for i,r in known.items()}
selected=set()
for axis in [0,1]:
    selected.add(min(angles,key=lambda i:angles[i][axis]));selected.add(max(angles,key=lambda i:angles[i][axis]))
while len(selected)<min(20,len(known)):
    candidate=max((i for i in known if i not in selected),key=lambda i:min(float(np.sum((angles[i]-angles[j])**2)) for j in selected))
    selected.add(candidate)
result=[]
for i,c in enumerate(new):
    if i not in selected:continue
    c['rotation']=known[i].tolist();c['extension']=True;result.append(c)
(BASE/'extra-cameras.json').write_text(json.dumps(result,indent=2));print('EXTERIOR_EXTENSION_COMPLETE',len(result),'of',len(new),flush=True)

keep={Path(c['image']).name for c in result}
for c in new:
    path=BASE/c['image']
    if path.name not in keep and path.resolve().parent==OUT.resolve():path.unlink(missing_ok=True)
