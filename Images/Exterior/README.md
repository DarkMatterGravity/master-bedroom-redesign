# Actual daytime exterior

`front.jpg` is the original IMG_7582 photograph; `water.jpg` is IMG_7580.
`view-00.jpg` through `view-08.jpg` are unretouched frames at one-second
intervals from IMG_7579.MOV (0 through 8 seconds, including its final frame).
The original movie and unused source photos remain local.

The current daytime viewer restores the first calibrated photo band: those
two stills and nine original frames on a 24-meter cylinder, with the original
positions, cropping and feathering. The later generated daytime panorama is
retained as an experimental asset. Night continues to use its stitched panorama.

`cameras.json` records focal length, principal point and relative camera
rotation estimated from SIFT feature matches and refined with OpenCV's
rotation bundle adjustment. Intrinsics are in each source image's pixels.

`tools/stitch-exterior.py` builds `panorama-day.jpg` and `panorama-night.jpg`.
The original photos/video retain their captured regions, including the porch
roof in `front.jpg`. Added footage from IMG_7590.MOV extends their coverage
instead of replacing objects already visible in those photographs. The new
video uses a separately measured 1095px focal length, rather than the earlier
video's approximately 879px value. Estimates from 63 within-video homographies
had a median of 1095px (middle half 1058–1128px).

Unit-ray RANSAC matches first build one coherent new sweep. Original cameras
then anchor its global orientation; near-singular homographies are rejected.
The 32 most distinct new directions provide additional coverage. The brown
house extension uses facade-plane alignment to its original window landmarks
and a shared exposure correction. This confines the extension to the building;
foreground fencing retains the camera projection rather than the facade plane.
Source pixels are inverse-warped into one equirectangular image; projections
behind cameras or outside their photographs are rejected. Graph-cut seams
prefer agreeing image regions and protect the house/water centers. Multiband blending
smooths exposure transitions. Clear-blue sky uses a common elevation profile
sampled from the original water photo to remove phone exposure changes. Sky
correction uses a connected sky/foreground mask so pale branches and white
facades remain intact; it has no hard elevation cutoff across the window view.

`tools/verify-quality.cjs` captures dedicated porch-roof, street-car, brown-house
and near-fence views in both modes. Inspect those images in `previews/` when
changing the stitch; geometric coverage tests alone cannot detect cut objects.

The panorama implementation displays its spherical mesh at a 24-meter radius. The
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
The upper window uses a 26-meter canopy dome with a window-opening mask. Its
sky and tree crop is anchored in room coordinates; movement reveals different
parts of that distant image through the frame. Beyond the captured crop it
blends to sky colour, avoiding stretched border pixels. This view is confined
to the upper opening so the three main windows retain their own surroundings.
