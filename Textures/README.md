# Photo-reference material assets

The albedos were prepared with the built-in `image_gen` tool using the user's
actual flooring and antique chest photos as references. The original reference
photos are preserved under `Images/References/`. The exact final prompt set is
saved in [generation-prompts.json](generation-prompts.json).

| Surface | Albedo | Surface maps |
| --- | --- | --- |
| Hardwood floor | `floor-albedo.png` | `floor-normal.png`, `floor-height.png`, `floor-roughness.png`, `floor-ao.png` |
| Shared chest/dresser wood | `antique-wood-albedo.png` | `antique-wood-normal.png`, `antique-wood-height.png`, `antique-wood-roughness.png`, `antique-wood-ao.png` |

Albedos are 1254 × 1254 pixels. Surface maps are 1024 × 1024 pixels. Albedos
use sRGB; all data maps use linear/no color conversion. Normal maps use the
OpenGL green-up convention. The floor is mapped continuously in world space
using an approximately 32-inch material repeat, rather than stretching a full
floor photograph onto each individual board.

The normal/height maps are inferred from local grain and surface contrast after
removing broad color/lighting variation. They are not measured scans. The floor
uses a subdivided L-shaped mesh with up to 0.65 mm of displacement range, plus
fine normal detail. The furniture uses the matching normal and height/bump maps
with conservative relief, varied roughness and subtle AO. Major furniture
depth—feet, moldings, inset panels, drawer fronts, flutes, handles and keyhole
plates—is modeled geometry.

Rebuild maps after replacing an albedo with:

```
node bake-photo-materials.cjs
```

This uses Playwright/Chrome and the running local server. `PLAYWRIGHT_PATH`
can point to an existing Playwright install. The app itself has no Playwright
dependency; it loads the saved PNG files offline.

The shared wood materials apply a luminance-preserving 65% chroma treatment in
the Three.js shader to soften the reference-derived orange streaks. Albedo PNGs
remain unchanged. The new timber bed, chest and dresser use this same material.
