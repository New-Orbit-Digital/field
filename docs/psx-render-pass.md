# PS1 render pass

Grimy PS1 look, done in the renderer so any models added later get it for free.

- **Low internal resolution:** the scene renders to a ~240-line target (`PSX.lines`) and is upscaled with nearest-neighbour. MSAA is off in this mode.
- **Vertex snapping:** three.js's `project_vertex` chunk is patched to snap clip-space positions to a 320×240 grid (`PSX.snap`). This covers every material, including shadows and loaded glTF models.
- **15-bit colour + ordered dither:** a 4×4 Bayer dither, then quantise to 31 levels per channel. This happens after tone mapping, in display space.
- **Snow points:** resized to match the low-res target, because three sizes points against the canvas.
- **Off switch:** `?psx=0` restores the original smooth renderer (reload needed).
- **Tuning:** the knobs are in `src/render/psx.js` → `PSX`.

## Not done yet
- Affine texture warping.
- Nearest filtering on loaded textures. Apply it when real assets arrive.

## Verification (2026-09-26)
- `npm test`: 30 pass, 0 fail.
- `npm run build`: OK.
- `npm run pages-check`: three loaded via the import map, sim ran live, 0 page or console errors.
- `npm run shots`: all 18 poses rendered, 0 errors. Reviewed 03-lunge-in-beam and 16-wreck.
