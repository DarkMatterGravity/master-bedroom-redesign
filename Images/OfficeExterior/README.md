# First-floor office exterior

Source: the user's `IMG_7622.MOV`, supplied 5 November 2026. The clip is a
12.97-second, 30-fps, 720-by-1280 portrait sweep. Twenty frames were extracted
at 0.65-second intervals starting at 0.1 seconds. Original selected frames
are saved here so registration and blending can be repeated without the MOV.

`cameras.json` stores fixed-lens rotation calibration. The focal length is
1004.3 pixels; frame-to-frame motion is fitted from reciprocal SIFT matches
with angular RANSAC, then jointly smoothed and levelled. Camera focal lengths
do not change between frames, and no projective content deformation is used.

`panorama-day.jpg` is the resulting equirectangular photograph. Frame 2.05 s
anchors the red house toward the end windows (+Z); the maple around 6.6 s falls
toward the long window wall (-X). Captured horizontal coverage is approximately
249 degrees. The exposure gains and photographic seams come only from this
clip, independently of the upstairs footage.

`margins-outpaint.png` extends the missing sky, foliage and ground using the
built-in image tool. `margins-prompt.md` records the exact prompt. These outer
margins are inferred, rather than recorded footage. The builder restores the
actual registered video pixels over this extension, using only a narrow
16-pixel feather at the capture boundary. Recorded buildings, fences and tree
trunks stay in their original positions; the extension fills the previously
blank margins instead of stretching photographed edge pixels.

`manifest.json` stores the runtime dimensions, origin and 10-metre radius.
The daylight image is hidden in night mode; no nighttime photograph was supplied.

Rebuild using `tools/calibrate-office-exterior.py` and
`tools/stitch-office-exterior.py`; see `tools/README.md` for commands.
