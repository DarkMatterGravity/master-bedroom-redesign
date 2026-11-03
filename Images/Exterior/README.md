# Actual daytime exterior

`front.jpg` is the original IMG_7582 photograph; `water.jpg` is IMG_7580.
`view-00.jpg` through `view-08.jpg` are unretouched frames at one-second
intervals from IMG_7579.MOV (0 through 8 seconds, including its final frame).
The original movie and unused source photos remain local.

`cameras.json` records focal length, principal point and relative camera
rotation estimated from SIFT feature matches and refined with OpenCV's
rotation bundle adjustment. Intrinsics are in each source image's pixels.

`tools/stitch-exterior.py` builds `panorama-day.jpg` and `panorama-night.jpg`.
The day image uses the distant water still and the new continuous sweep from
IMG_7590.MOV (63 sampled frames for registration). Unit-ray feature matching,
RANSAC and joint rotation averaging
register the new footage against fixed original house/water camera anchors.
The 32 most distinct new viewing directions provide the final coverage.
Earlier front-facing photos anchor camera directions but are not overlaid on
the new nearby trees: their different capture position causes parallax seams.
Source pixels are inverse-warped into one equirectangular image; projections
behind cameras or outside their photographs are rejected. Graph-cut seams
prefer agreeing image regions and protect the house/water centers. Multiband blending
smooths exposure transitions. Clear-blue sky uses a common elevation profile
sampled from the original water photo to remove phone exposure changes.

`exterior.js` displays one spherical mesh per mode at a 24-meter radius. The
water photograph faces the paired north windows; the front photograph faces
west. There are no overlapping runtime photo panels or clamped edge samples.
Night uses its own stitched texture from the calibrated frames in `Night/`.
The front-window plantation shutters stay open.

Run `python tools/stitch-exterior.py` from the project root with OpenCV/NumPy
installed and IMG_7590.MOV available in Downloads. Extracted frames, camera
registration cache and coverage masks stay under ignored `previews/`.

These are photographic surroundings, not reconstructed buildings. Nearby
fences/branches can retain small parallax differences between captures. Areas
never photographed use a soft color continuation, with clear sky above the
horizon; coverage masks record which pixels came from the actual captures.
The upper window retains its separate sky-cropped backdrop.
