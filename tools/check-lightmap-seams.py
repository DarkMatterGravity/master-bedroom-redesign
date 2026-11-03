"""Verify continuous baked UVs along shared edges of large flat surfaces."""
from pathlib import Path
import json,numpy as np
ROOT=Path(__file__).resolve().parents[1]
scene=json.loads((ROOT/'previews/blender-scene.json').read_text())
manifest=json.loads((ROOT/'Textures/Lighting/manifest.json').read_text())
records={r['id']:r for r in manifest['records']}
uv=np.fromfile(ROOT/'Textures/Lighting/room-uv.bin',np.float32).reshape(-1,2)
checked=0;seams=[]
for data in scene['meshes']:
    if data['softgoods']:continue
    p=np.asarray(data['positions']).reshape(-1,3);indices=np.asarray(data['indices'] or list(range(len(p)))).reshape(-1,3)
    triangles=p[indices];cross=np.cross(triangles[:,1]-triangles[:,0],triangles[:,2]-triangles[:,0]);area=np.linalg.norm(cross,axis=1)/2
    if not np.any(area>.08):continue
    normals=cross/np.maximum(2*area[:,None],1e-20);record=records[data['id']]
    faceuv=uv[record['offset']:record['offset']+record['count']].reshape(-1,3,2);edges={}
    for f in np.where(area>.08)[0]:
        for a,b in [(0,1),(1,2),(2,0)]:
            pa=tuple(np.round(triangles[f,a],6));pb=tuple(np.round(triangles[f,b],6));key=tuple(sorted((pa,pb)))
            if key in edges:
                other,points=edges[key]
                if np.dot(normals[f],normals[other])>.999999:
                    checked+=1;current={pa:faceuv[f,a],pb:faceuv[f,b]};delta=max(float(np.linalg.norm(points[k]-current[k])) for k in key)
                    if delta>1e-5:seams.append({'id':data['id'],'name':data['name'],'delta':delta})
            edges[key]=(f,{pa:faceuv[f,a],pb:faceuv[f,b]})
result={'coplanarEdgesChecked':checked,'discontinuousEdges':len(seams),'examples':seams[:10]}
print(json.dumps(result));(ROOT/'previews/lightmap-seam-check.json').write_text(json.dumps(result,indent=2))
if seams:raise SystemExit(1)
