# Master bedroom · interactive room study

[Open the latest design online](https://darkmattergravity.github.io/master-bedroom-redesign/?design=4).
The hosted viewer runs directly in a browser; no installation is needed.
Daytime windows show the actual neighborhood and water view, projected onto
a curved exterior band from two photos and nine calibrated video frames.
Night mode uses a matching curved panorama from nine frames of the actual
nighttime sweep, with the front-window plantation shutters closed.

To run locally, double-click **Start-Room.cmd** on Windows, or run `python serve.py` in this folder.
The server opens http://127.0.0.1:8000 in your browser. Keep its terminal window open.
Python 3 and a browser with WebGL 2 are required. Three.js is included locally;
the viewer does not need an internet connection. Open through the local server,
since browser security restricts JavaScript modules opened as `file://` URLs.

## Controls

The browser displays the room with small day/night and floor-plan toggles in the upper-right corner.

- Select **Before** or **After** in the upper-left to compare the original room and latest redesign from the same camera position.
- Drag anywhere in the room to look around, including up at the ceiling.
- WASD / arrow keys move around the room.
- Scroll to change the field of view.
- The floor-plan toggle shows or hides a live map of your position and viewing direction. It starts hidden.
- Use the day/night toggle to switch between sunny windows and a black exterior.
- Reload the page to restore the entrance camera and sunny daylight.

## Model dimensions and interpretation

The geometry uses meters internally (`1 inch = 0.0254 meters`). Sketch X runs
left to right and sketch Z runs top to bottom. The floor polygon in inches is:
`(0,0), (169,0), (169,120), (124,120), (124,187), (0,187)`.

This is a 169 × 187-inch bounding rectangle with the bottom-right 45 × 67-inch
hallway notch removed, giving approximately 198.5 square feet. Ceiling: 96 inches.

- Bed headboard is along the bottom wall; king mattress is assumed 76 × 80 inches.
- North/top window: X 25–59 inches. West/left window: Z 25–59 inches.
- Both windows are 34 inches wide. The corner offsets are interpreted as 25 inches.
- Estimated window sill: 28 inches, opening height: 56 inches.
- Desk on the top wall: 41 × 21 inches (43 × 23-inch overhanging top modeled).
- Chest at the foot of the bed: 48 × 19 inches (49 × 20-inch cushion modeled).
- Dresser on the right wall: 33 × 19 inches (35 × 21-inch overhanging top modeled).
- Closet door on the right wall: 24 inches, located near the upper corner.
- Entry at the notch: 30 inches, facing the desk/window end of the room.
- Door height: assumed 80 inches. Furniture heights, unmarked offsets, trim,
  paint, shutters and ceiling fan are estimated from the photos.

Furniture, doors, shutters, lighting, trim and exterior context are actual 3D
meshes created in `room.js`. Bedding is shaped geometry with quilt seams.
The six-face skybox is procedurally generated. In daylight, nearly white glazing,
soft additive halos and stronger window fill simulate very sunny, overexposed
windows. Night hides every outdoor mesh, makes the window panes and sky black, and turns off daylight and window halos.
Outdoor houses/trees and the
short hallway/closet interiors are illustrative context. Indoor lighting uses
shadowed sunlight with fill lights to approximate bounced light, rather than
an architectural light simulation. Navigation is restricted to the bedroom
footprint and major furniture; doors are visual models rather than interactive doors.

## Files

- `index.html`, `style.css`, `room.js`: application and editable model.
- `Images/`: original photographs and measured sketch, unchanged.
- `vendor/`: Three.js 0.180.0 (MIT licensed), included for offline use.
- `serve.py`, `Start-Room.cmd`: local server and Windows launcher.

Three.js documentation: https://threejs.org/docs/

## Design variants

**1 ? Existing room:** the original blue room, dark bed and fan, desk, dresser,
shutters, chest and side tables. The hallway door remains closed. Decorative
white pane grids have been removed from every window in all variants.

**2 ? Warm beige, linen & walnut:** inspired by the six references in
`Images/Inspiration/`. It uses light warm beige walls, matching tall beige paneling, a broad solid-wood
headboard and low timber platform, cream duvet, slate throw, houndstooth pillows, a flatweave rug,
a walnut dresser and slim bench, linen curtains, and a dramatic full-height
white horizontal shiplap bed wall with a large framed landscape and brass
gallery light. Two brass-and-opal wall sconces
replace the nightstands and table lamps. The desk, chair, corner plant, old paired paintings,
and ceiling pendant have been removed. The king mattress stays 76 ? 80 inches.

**3 ? Vaulted shiplap:** keeps variant 2's decor and king bed, replaces the flat
ceiling with individual white shiplap boards, and raises the walls to the roof.
The main ceiling rises at 30 degrees from the desk wall's 96-inch edge to a
ridge at Z = 163 inches, 24 inches forward of the bed wall. The ridge height is
approximately 190.11 inches (15 feet 10 inches). The short rear roof plane
also descends at 30 degrees. The bed wall and its paneled feature rise vertically
to meet it at approximately 176.25 inches (14 feet 8 inches), with no upper
molding on that wall. No ceiling pendant remains. This is a visual roof concept.

Variant 3 has a new **28 ? 28-inch Craftsman window on the west gable wall**,
directly opposite its first proposed location. It is centered at Z = 163 inches,
with its opening top 36 inches below the ridge (8 inches lower than initially
modeled). Simple flat white casing surrounds all four sides of the real wall opening,
with no projecting sill, apron or header cap. The clear glass glows in daylight and shows a sky-only crop of the supplied
photo at night.

Versions 2 and 3 replace the original desk-wall window with a paired unit:
two 34-inch windows separated by a 3-inch mullion, in one 71-inch opening
from X = 25 to X = 96 inches. They share a continuous outer casing and sill,
one extended curtain rod and two curtain panels at the outer edges. The
perpendicular wall's existing window stays the same. All curtain hems finish
10 inches above the floor, clearing the baseboard heaters by about 2.5 inches.
The chair rail reaches approximately 61.6 inches, near the bottom of the
sconces, and continues through the corners. Paneling and rails use the same
light beige as the walls, with a slightly smoother finish. Paneling only drops
below the low window sills. Vertical stiles meet their top and bottom rails.

`designs.js` generates tileable albedo, tangent-space normal, and roughness maps
for linen, plaster, wood, and rug pile, plus a patterned pillow texture. These
are inferred materials rather than scans or maps extracted from the screenshots.
Brass uses metalness and roughness. The dresser top is clear, with the mirror, vase and stem removed. Lighting remains an approximation. All textures are
generated locally. `vaulted.js` contains the ceiling, wall extensions, shiplap
and high window. Design changes update collisions and preserve a valid camera.

Day/night and the optional live floor plan work in every design. Night hides
all outdoor meshes. The paired desk-wall windows in variants 2 and 3 show the
provided nighttime skyline photo (`Images/Night-Skyline.jpg`) as one continuous
view. The upper gable window shows a sky-only crop from that same photo.
Other windows stay black. Daytime keeps the original bright white glazing
and glow. Variant 1 is the reference
layout; modifications and the feature wall belong to variants 2 and 3.

`glass.js` adds a subtle Fresnel reflection shader to all window panes. A small
HDR cubemap captures the current room on design/day-night changes. Reflections
strengthen at grazing angles and move with the camera; they are deliberately
faint so the skyline/sky and bright daytime glazing stay visible. This is a
cached room environment reflection rather than a separate planar reflection
render for every pane on every frame.

At night, the single west-wall window is covered by four closed plantation-shutter
leaves with louver geometry and tilt rods. They retract in daylight; the paired
windows retain the skyline view and the upper window retains the sky crop.

The wainscoting and chair rail also cover the short return beside the hallway
door, continuing around the notch corner at the same height as the other walls.

## Collar-tie ceiling comparison (version 4)

Version 4 keeps version 3's room and adds a flat white shiplap ceiling at the
**176.25-inch / 14-foot-8-inch** top of the bed feature wall. The flat section
meets the long 30-degree roof slope at Z = 139 inches and continues to the bed
wall at Z = 187 inches. It spans the full 124-inch room width and is **48 inches
deep** from front to back. The original roof profile stays above the flat cap,
leaving a triangular concealed space with approximately **13.86 inches of
maximum height** at the ridge. This visualizes a small enclosure for collar ties
and services; it does not specify framing or duct dimensions. The upper window,
sconces, feature wall, day/night views and floor-plan toggle remain the same.
Select 3 for the full peak or 4 for the flat-topped version.

The shiplap feature wall is excluded from the surrounding wainscoting treatment.
Its individual 5.5-inch white boards extend to the ceiling in each design.
One 62 ? 28-inch original abstract coastal landscape sits above the headboard,
in a slim dark/brass frame. Its brass gallery fixture has two warm spotlights.
Curtains use broad, smooth S-shaped folds with tighter gathering at the rod,
a little billow below, and slightly relaxed hems, maintaining heater clearance.

Both door leaves are 80 inches high, matching their frame openings and closing
the previous one-inch gap beneath the header trim.

Current wall and wainscoting paint in versions 2?4 is light warm beige
(`#d8cebf`), including the chair rail and corner trim. The white shiplap
feature wall and reference version 1 retain their colors.

In versions 2?4 the 30-inch hallway door is centered on the 45-inch short wall,
leaving 7.5 inches on each side of the opening. The casing and matching beige
wainscoting returns are fitted on both sides, and the floor plan uses the new
opening location. Reference version 1 keeps its original doorway position.

## Actual flooring, chest and dresser

The floor and both antique furniture pieces now use photo-reference materials
from the user's newer close-up photos. See `Textures/README.md` for saved albedo,
normal, height, roughness and AO maps and their generation prompts. The original
photos are preserved under `Images/References/`. The photo-based floor and
furniture are shared by every room variant.

`photo-materials.js` loads these maps and creates a world-mapped, subdivided
L-shaped floor with conservative geometric displacement. `antique-furniture.js`
models the 48 ? 19-inch chest and 33 ? 19-inch five-drawer dresser: stepped lid
and crown moldings, recessed front/side panels, shaped bracket feet, fluted posts,
engraved bands, curved dark metal handles and round keyhole escutcheons. The
chest replaces the earlier bench, and the dresser replaces the simple concept
cabinet. Furniture tops remain clear. These are modeled/photo-reference
reconstructions, not photogrammetric scans of hidden surfaces.

The chest and dresser wood finish is now reduced to 65% of its original chroma
in the material shader, preserving local luminance and all texture detail while
muting orange grain. Versions 2?4 use that exact same finish for a low solid-wood
platform bed and broad slab headboard, following inspiration IMG_7558. The frame
is 84 ? 84 inches, its top/support level is 13 inches, and its headboard top is
42 inches. The mattress stays **76 ? 80 inches**, in the same location and at
the same height. Artwork and its gallery light are lowered 8 inches to balance
the lower wooden headboard. Original version 1 retains its reference bed.

## Latest joinery, artwork and fixture details

`joinery.js` builds trim with actual mitered ends: chair rails, corner stiles,
base and crown molding, window/door casing and layered picture frames now meet
along angled cuts instead of overlapping blocks. The low timber bed's four
miter-joined perimeter panels extend slightly into the floor, fully enclosing
the underside with no exposed legs or cat-access gap. Mattress dimensions and
platform height stay unchanged.

The large bed-wall painting now has a broad, layered 3-inch black mitered frame.
The gallery fixture and both bedside wall sconces have a black finish. Your
actual family photo, preserved as `Images/References/Family-portrait.jpg`, hangs
above the dresser in a 20-inch dark frame with a cream mat; the original print
is selected directly with UV coordinates, preserving the people in the photo.

A 26 ? 44-inch portrait-format painting is centered at X = 139.5 inches on the
clear wall area between the paired-window curtain and closet-side corner. Its
wide black frame matches the others and stands clear of the chair rail. The
new artwork applies to versions 2?4; the family photo above the shared dresser
is present in every version.

Curtain linen now uses a deeper warm beige (`#9c8c75`), retaining its
woven normal/roughness maps and smooth S-shaped drape in versions 2?4.

The tall window-wall painting is now 26 ? 56 inches, centered at 55 inches
above the floor (12 inches lower than before). Its 3-inch black frame remains
uniform in width. A matching black gallery light casts warm light onto it.
