# Actual daytime exterior

`front.jpg` is the original IMG_7582 photograph; `water.jpg` is IMG_7580.
`view-00.jpg` through `view-08.jpg` are unretouched frames at one-second
intervals from IMG_7579.MOV (0 through 8 seconds, including its final frame).
The original movie and unused source photos remain local.

`cameras.json` records focal length, principal point and relative camera
rotation estimated from SIFT feature matches and refined with OpenCV's
rotation bundle adjustment. Intrinsics are in each source image's pixels.

`exterior.js` projects these overlapping photographs onto a 24-meter-radius
cylinder outside the room. The water photograph faces the paired north
windows; the front photograph faces west. Feathered edges blend the patches,
and the higher resolution stills overlay the video coverage. The photographed
front sill/jamb is omitted using UV bounds. These are photographic backdrops,
not a reconstruction of the outdoor buildings: movement has approximate
parallax, and nearby objects can show minor capture alignment differences.

The band is visible by day. Night switches to the matching calibrated video
patches in `Night/`; the front-window plantation shutters stay open.

`Extra/` contains 20 additional frames from IMG_7590.MOV. Their rotations in
`extra-cameras.json` are registered against the original fixed cameras using
`tools/extend-exterior.py`. They extend the sky, ground and side coverage
without changing the approved window alignment. They render behind the
original photographs and use half-resolution textures on phones.

A complete cylindrical photographic back layer fills directions beyond the
captured frames in both modes. It uses clamped samples from the corresponding
front/water photos; at extreme angles this can stretch edge details. The upper
window has its own enlarged, sky-cropped backdrop to avoid bare gray edges.
