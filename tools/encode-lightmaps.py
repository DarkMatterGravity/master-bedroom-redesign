"""Package denoised linear float bakes as lossless-range RGBE light maps.

Shared-exponent RGBE avoids the colored banding of 8-bit linear PNG in dark
interiors while keeping downloads small. OpenCV writes the Radiance RLE file.
"""
from pathlib import Path
import cv2,numpy as np
ROOT=Path(__file__).resolve().parents[1]
for mode in ['day','night']:
    # Blender image buffers start at the bottom; Radiance scanlines start top.
    rgb=np.load(ROOT/'previews'/f'light-{mode}.npy')[::-1].copy()
    for suffix,size in [('',2048),('-mobile',1024)]:
        data=rgb if size==2048 else cv2.resize(rgb,(size,size),interpolation=cv2.INTER_AREA)
        path=ROOT/'Textures/Lighting'/f'room-{mode}{suffix}.hdr'
        if not cv2.imwrite(str(path),data[:,:,::-1]):raise RuntimeError(f'Could not save {path}')
        print(path.name,path.stat().st_size)
