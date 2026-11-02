# Matching nighttime exterior

The nine JPEGs are unretouched frames from IMG_7583.MOV, captured at frames
0, 24, 48, 72, 96, 120, 144, 168 and 194 of the 24 fps, 720 x 1280 movie.
The original movie stays local. No city lights or buildings were generated.

SIFT matches and OpenCV rotation bundle adjustment estimate `cameras.json`.
Frame 0 anchors the front/house direction; frame 5 anchors the water direction.
The runtime projects these patches onto the same 24-meter-radius cylinder as
daytime, feathers overlapping edges, and levels the slightly downward night
camera by a 0.075 vertical slope correction. It is a photographic approximation;
low-light motion blur, glass reflections and small foreground alignment
differences remain from the original footage.

The upper window uses only upper-central sky from frame 4. Closed plantation
shutters continue to cover the front window at night. Daytime assets and their
calibration are independent of this night capture.
