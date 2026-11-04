"""Average upholstery bake noise across welded vertices and nearby surface edges."""
import json,numpy as np,os
from pathlib import Path
os.chdir(Path(__file__).resolve().parents[1])
src={m['id']:m for m in json.loads(Path('previews/blender-scene.json').read_text())['meshes']}
manifest=json.loads(Path('Textures/Seating/manifest.json').read_text())
for mode in ['day','night']:
    path=Path('Textures/Seating')/(mode+'.bin');data=np.fromfile(path,dtype=np.float16).astype(np.float32).reshape(-1,3)
    for r in manifest['records']:
        m=src[r['id']]
        if m['seating'] not in ['leather','pillow']:continue
        positions=np.array(m['positions']).reshape(-1,3);indices=np.array(m['indices'],dtype=int)
        p=positions[indices] if indices.size else positions
        _,weld=np.unique(np.round(p,5),axis=0,return_inverse=True);n=weld.max()+1;counts=np.bincount(weld,minlength=n)
        v=data[r['offset']:r['offset']+r['count']];colors=np.stack([np.bincount(weld,weights=v[:,k],minlength=n)/counts for k in range(3)],axis=1)
        tri=weld.reshape(-1,3);edges=np.concatenate([tri[:,[0,1]],tri[:,[1,2]],tri[:,[2,0]]]);edges=np.concatenate([edges,edges[:,::-1]]);edges=np.unique(edges,axis=0);a,b=edges.T;degree=np.bincount(a,minlength=n)
        for _ in range(4):
            neighbors=np.stack([np.bincount(a,weights=colors[b,k],minlength=n)/np.maximum(degree,1) for k in range(3)],axis=1)
            colors=colors*.5+neighbors*.5
        v[:]=colors[weld]
    data.astype(np.float16).tofile(path)
print('Smoothed upholstery GI')
